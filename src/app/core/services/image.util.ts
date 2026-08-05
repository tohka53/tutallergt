/**
 * Reducción de imágenes en el navegador, antes de guardarlas.
 *
 * Why: el mecánico toma las fotos con el teléfono y cada una pesa entre 3 y 8
 * MB. Guardarlas tal cual llena la cuota de almacenamiento del navegador y hace
 * lentísima la carga en el portal del cliente (que muchas veces entra con datos
 * móviles). Una foto de 1600px de lado mayor a calidad 0.82 se ve idéntica en
 * pantalla y pesa entre 200 y 500 KB.
 *
 * La orientación EXIF la aplican los navegadores actuales al dibujar un <img>
 * (`image-orientation: from-image` es el valor por omisión), así que la foto
 * vertical del teléfono no queda acostada.
 */

export interface DownscaleOptions {
  /** Lado mayor máximo, en píxeles. */
  maxSide?: number;
  /** Calidad JPEG (0-1). */
  quality?: number;
}

const DEFAULTS: Required<DownscaleOptions> = { maxSide: 1600, quality: 0.82 };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

/**
 * Devuelve una versión reducida del archivo. Si algo falla (formato que el
 * navegador no sabe dibujar, canvas bloqueado) o si el resultado no es más
 * liviano que el original, devuelve el archivo original sin tocarlo: nunca se
 * pierde la foto por intentar optimizarla.
 */
export async function downscaleImage(file: File, options: DownscaleOptions = {}): Promise<File> {
  const { maxSide, quality } = { ...DEFAULTS, ...options };
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const largest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!largest) { return file; }

    const scale = Math.min(1, maxSide / largest);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return file; }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await toBlob(canvas, quality);
    if (!blob || blob.size >= file.size) { return file; }

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
