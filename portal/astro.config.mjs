import { defineConfig } from 'astro/config';

// The portal is a decoupled frontend - it never talks to the Frappe Desk.
// All data comes from edupro_financials' whitelisted REST methods on the
// Avondale bench. Proxying /api in dev keeps every request same-origin
// from the browser's point of view, so the Frappe session cookie just
// works with no CORS/SameSite fighting. In production this same proxy
// rule needs to exist at the reverse-proxy layer (nginx) in front of
// both the built portal and the Frappe site.
const FRAPPE_BACKEND = 'http://avondale.localhost:8000';

export default defineConfig({
	compressHTML: true,
	vite: {
		server: {
			proxy: {
				'/api': {
					target: FRAPPE_BACKEND,
					changeOrigin: true,
				},
			},
		},
	},
});
