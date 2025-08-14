// Utilitários para formatação de dados

/**
 * Converte um valor para número e formata com casas decimais
 * @param value - Valor a ser convertido (string ou number)
 * @param decimals - Número de casas decimais (padrão: 2)
 * @param fallback - Valor de fallback se conversão falhar (padrão: 'N/A')
 * @returns String formatada ou fallback
 */
export const formatPrice = (
  value: string | number | null | undefined, 
  decimals: number = 2, 
  fallback: string = 'N/A'
): string => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return fallback;
  }
  
  return numValue.toFixed(decimals);
};

/**
 * Formata um valor monetário com símbolo de dólar
 * @param value - Valor a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @param fallback - Valor de fallback (padrão: 'N/A')
 * @returns String formatada com $
 */
export const formatCurrency = (
  value: string | number | null | undefined, 
  decimals: number = 2, 
  fallback: string = 'N/A'
): string => {
  const formatted = formatPrice(value, decimals, fallback);
  return formatted === fallback ? fallback : `$${formatted}`;
};

/**
 * Formata uma porcentagem
 * @param value - Valor a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @param showSign - Se deve mostrar o sinal + para valores positivos
 * @returns String formatada com %
 */
export const formatPercentage = (
  value: string | number | null | undefined, 
  decimals: number = 2,
  showSign: boolean = true
): string => {
  const formatted = formatPrice(value, decimals, 'N/A');
  if (formatted === 'N/A') return formatted;
  
  const numValue = parseFloat(formatted);
  const sign = showSign && numValue > 0 ? '+' : '';
  return `${sign}${formatted}%`;
};

/**
 * Formata volume em milhões
 * @param value - Valor do volume
 * @param decimals - Número de casas decimais (padrão: 1)
 * @returns String formatada com M
 */
export const formatVolume = (
  value: string | number | null | undefined, 
  decimals: number = 1
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (!numValue || isNaN(numValue)) return '0M';
  
  const millions = numValue / 1000000;
  return `${millions.toFixed(decimals)}M`;
};

/**
 * Formata quantidade baseada no ativo
 * @param value - Valor da quantidade
 * @param asset - Nome do ativo (para determinar casas decimais)
 * @returns String formatada
 */
export const formatQuantity = (
  value: string | number | null | undefined,
  asset: string = ''
): string => {
  // USDT e outras stablecoins: 2 casas decimais
  // Outras criptos: 6 casas decimais
  const decimals = asset === 'USDT' || asset.includes('USD') ? 2 : 6;
  return formatPrice(value, decimals);
};