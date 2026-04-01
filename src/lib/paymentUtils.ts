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
 * Países donde usamos MercadoPago (LATAM típico). Fuera de esta lista → Stripe (tarjeta internacional).
 * EE. UU. y Canadá usan Stripe en USD, no MercadoPago.
 */
const MERCADOPAGO_COUNTRY_CODES = new Set([
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "EC",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PY",
  "SV",
  "UY",
  "DO",
]);

export function usesMercadoPagoForCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return MERCADOPAGO_COUNTRY_CODES.has(countryCode.toUpperCase());
}

/**
 * Moneda Stripe: USD para EE. UU. y Canadá; EUR para el resto de clientes Stripe (Europa, UK, etc.).
 */
export function getStripeCurrencyForCountry(countryCode: string | null | undefined): "eur" | "usd" {
  const cc = countryCode?.toUpperCase() || "";
  if (cc === "US" || cc === "CA") return "usd";
  return "eur";
}

export async function getStripeCurrency(): Promise<"eur" | "usd"> {
  const countryCode = await getUserCountryCode();
  return getStripeCurrencyForCountry(countryCode);
}

/**
 * Fallback cuando solo tenemos el nombre del país en texto (ej. Firestore `pais`).
 */
export function inferStripeCurrencyFromCountryLabel(pais?: string | null): "eur" | "usd" {
  const p = (pais || "").toLowerCase();
  if (
    /\b(estados unidos|united states|u\.s\.?a\.?|usa|eeuu|ee\.?\s*uu\.?)\b/.test(p) ||
    /\b(canad[áa]|canada)\b/.test(p)
  ) {
    return "usd";
  }
  return "eur";
}

/**
 * Determina qué proveedor de pago usar según país (IP).
 * - MercadoPago: LATAM listado
 * - Stripe: Europa, EE. UU., Canadá, Australia, UK, y resto no-LATAM
 */
export async function getPaymentProvider(): Promise<"stripe" | "mercadopago"> {
  const countryCode = await getUserCountryCode();
  if (usesMercadoPagoForCountry(countryCode)) return "mercadopago";
  return "stripe";
}

