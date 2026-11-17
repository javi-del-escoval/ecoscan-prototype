# EcoScan — prototipo demostrativo

Prototipo frontend (React + Vite + PWA) con datos ficticios. Ver `spec.md` para el alcance.

```bash
npm install        # instalar dependencias
npm run dev        # desarrollo
npm run build      # build estático en dist/
npm run preview    # probar el build localmente
```

## Despliegue en Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

Alternativa por CLI: `npx wrangler pages deploy dist`

## Visión por computador

El escaneo usa MobileNet (TensorFlow.js) ejecutado en el navegador: es gratuito, no usa claves de API ni servidor, y la imagen no sale del dispositivo. Los pesos del modelo se descargan la primera vez que se usa (requiere conexión). El modelo es genérico (ImageNet) y puede equivocarse; no detecta contaminación y no reconoce envases de bebida (cartón).
