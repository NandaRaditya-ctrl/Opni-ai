export async function POST(req: Request) {
	try {
		let body: any = {};
		try {
			// Prefer JSON parsing when possible
			body = await req.json().catch(() => ({}));
			// If JSON was empty object, try reading raw text (some clients send raw bodies differently)
			if (!body || (Object.keys(body).length === 0 && body.constructor === Object)) {
				const text = await req.text().catch(() => '');
				if (text) {
					try {
						body = JSON.parse(text);
					} catch (_) {
						try {
							body = Object.fromEntries(new URLSearchParams(text));
						} catch (_e) {
							// leave as {}
						}
					}
				}
			}
		} catch (_e) {
			body = {};
		}
		const prompt = (body && (body.prompt || body.message || body.text)) || '';

		// Demo fallback: if DEMO_MODE=true or client requests demo, return a canned reply
		const demoMode = process.env.DEMO_MODE === 'true' || body?.demo === true;
		if (demoMode) {
			const reply = `Demo mode reply for prompt: ${prompt || '<empty>'}`;
			return new Response(JSON.stringify({ reply }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		if (!prompt) {
			return new Response(JSON.stringify({ error: 'Missing prompt in request body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// If HF API key is set or client requested HF, use Hugging Face Inference API
		const useHF = Boolean(process.env.HF_API_KEY) || body.use === 'hf';
		if (useHF) {
			const hfModel = (body && body.model) || process.env.HF_MODEL || 'gpt2';
			try {
				const hfResp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(hfModel)}`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${process.env.HF_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ inputs: prompt }),
				});

				if (!hfResp.ok) {
					const details = await hfResp.text().catch(() => '');
					return new Response(JSON.stringify({ error: 'HF request failed', details }), {
						status: 502,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const json = await hfResp.json().catch(() => null);
				let reply = '';
				if (Array.isArray(json)) {
					// e.g. [{generated_text: '...'}]
					if (json.length > 0 && typeof json[0].generated_text === 'string') reply = json[0].generated_text;
					else if (json.length > 0 && typeof json[0].body === 'string') reply = json[0].body;
					else reply = JSON.stringify(json);
				} else if (json && typeof json === 'object') {
					if (typeof json.generated_text === 'string') reply = json.generated_text;
					else reply = JSON.stringify(json);
				} else if (typeof json === 'string') {
					reply = json;
				} else {
					reply = String(json ?? '');
				}

				return new Response(JSON.stringify({ reply }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (e) {
				return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
			}
		}

		// Otherwise, default to Ollama local server
		const model = (body && body.model) || process.env.OLLAMA_MODEL || 'phi3:mini';
		const ollamaUrl = `http://localhost:11434/api/generate`;

		// Send JSON body { model, prompt } which Ollama expects
		let resp: Response;
		try {
			resp = await fetch(ollamaUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model, prompt }),
			});
		} catch (e) {
			return new Response(JSON.stringify({ error: 'Unable to reach Ollama server at http://localhost:11434. Make sure Ollama is running (ollama serve) or set HF_API_KEY.' }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const raw = await resp.text().catch(() => '');

		if (!resp.ok) {
			const lower = raw.toLowerCase();
			const modelNotFound = lower.includes('model') && lower.includes('not found');
			const outOfMemory = lower.includes('requires more system memory') || lower.includes('out of memory') || lower.includes('memory');
			let suggestion = '';
			if (modelNotFound) {
				suggestion = `Model '${model}' not found on Ollama. Run: ollama pull ${model} && ollama serve`;
			} else if (outOfMemory) {
				suggestion = `Model '${model}' failed to start due to insufficient system memory. Use a smaller model, increase available RAM/swap, or use the Hugging Face API by setting HF_API_KEY.`;
			}

			// Automatic fallback: if OOM on Ollama and HF API key is present, try HF instead
			if (outOfMemory && process.env.HF_API_KEY) {
				try {
					const hfModel = (body && body.model) || process.env.HF_MODEL || 'gpt2';
					const hfResp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(hfModel)}`, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${process.env.HF_API_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ inputs: prompt }),
					});

					if (hfResp.ok) {
						const json = await hfResp.json().catch(() => null);
						let reply = '';
						if (Array.isArray(json)) {
							if (json.length > 0 && typeof json[0].generated_text === 'string') reply = json[0].generated_text;
							else if (json.length > 0 && typeof json[0].body === 'string') reply = json[0].body;
							else reply = JSON.stringify(json);
						} else if (json && typeof json === 'object') {
							if (typeof json.generated_text === 'string') reply = json.generated_text;
							else reply = JSON.stringify(json);
						} else if (typeof json === 'string') {
							reply = json;
						} else {
							reply = String(json ?? '');
						}

						return new Response(JSON.stringify({ reply, fallback: 'hf' }), {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						});
					}
				} catch (e) {
					// if HF fallback also fails, continue to return original Ollama error below
				}
			}

			// If DEMO_MODE is enabled, return a canned demo response instead of failing
			if (process.env.DEMO_MODE === 'true') {
				const demoReply = `Demo reply (fallback): ${prompt || '<empty>'}`;
				return new Response(JSON.stringify({ reply: demoReply, fallback: 'demo', suggestion }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ error: 'Ollama request failed', details: raw, suggestion }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Ollama often streams JSON lines; try to parse NDJSON and concatenate `response` fields
		let reply = raw;
		try {
			const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
			const parts: string[] = [];
			for (const line of lines) {
				try {
					const j = JSON.parse(line);
					if (typeof j === 'object' && j !== null) {
						if (typeof j.response === 'string') parts.push(j.response);
						else if (typeof j.reply === 'string') parts.push(j.reply);
						else if (typeof j.text === 'string') parts.push(j.text);
					}
				} catch (e) {
					// ignore non-json lines
				}
			}
			if (parts.length > 0) reply = parts.join('');
		} catch (e) {
			// fallback to raw
		}

		return new Response(JSON.stringify({ reply }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

export async function GET() {
	return new Response(JSON.stringify({ ok: true, message: 'Ollama proxy endpoint. POST {prompt:"..."}' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

