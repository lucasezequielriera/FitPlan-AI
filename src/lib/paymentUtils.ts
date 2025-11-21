/**
 * Lista de códigos de países europeos
 * Basado en la lista oficial de países de la UE y otros países europeos
 */
const EUROPEAN_COUNTRIES = [
  'AD', // Andorra
  'AL', // Albania
  'AT', // Austria
  'BA', // Bosnia y Herzegovina
  'BE', // Bélgica
  'BG', // Bulgaria
  'BY', // Bielorrusia
  'CH', // Suiza
  'CY', // Chipre
  'CZ', // República Checa
  'DE', // Alemania
  'DK', // Dinamarca
  'EE', // Estonia
  'ES', // España
  'FI', // Finlandia
  'FR', // Francia
  'GB', // Reino Unido
  'GR', // Grecia
  'HR', // Croacia
  'HU', // Hungría
  'IE', // Irlanda
  'IS', // Islandia
  'IT', // Italia
  'LI', // Liechtenstein
  'LT', // Lituania
  'LU', // Luxemburgo
  'LV', // Letonia
  'MC', // Mónaco
  'MD', // Moldavia
  'ME', // Montenegro
  'MK', // Macedonia del Norte
  'MT', // Malta
  'NL', // Países Bajos
  'NO', // Noruega
  'PL', // Polonia
  'PT', // Portugal
  'RO', // Rumania
  'RS', // Serbia
  'SE', // Suecia
  'SI', // Eslovenia
  'SK', // Eslovaquia
  'SM', // San Marino
  'UA', // Ucrania
  'VA', // Ciudad del Vaticano
  'XK', // Kosovo
];

/**
 * Detecta si un código de país pertenece a Europa
 */
export function isEuropeanCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return EUROPEAN_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Obtiene el país del usuario basado en su IP
 * Retorna el código del país o null si no se puede determinar
 */
export async function getUserCountryCode(): Promise<string | null> {
  try {
    const response = await fetch('/api/getUserLocation');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.countryCode || null;
  } catch (error) {
    console.error('Error al obtener código de país:', error);
    return null;
  }
}

/**
 * Determina qué proveedor de pago usar basado en la ubicación del usuario
 * @returns 'stripe' para Europa, 'mercadopago' para otros países
 */
export async function getPaymentProvider(): Promise<'stripe' | 'mercadopago'> {
  const countryCode = await getUserCountryCode();
  return isEuropeanCountry(countryCode) ? 'stripe' : 'mercadopago';
}

