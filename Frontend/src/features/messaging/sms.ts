/** Segmentos de SMS (GSM-7: 160/153; com acentos fora do alfabeto GSM: 70/67). */
export function smsSegments(text: string): number {
  if (text.length === 0) return 0
  const gsm =
    /^[\n\r @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/.test(
      text,
    )
  const [single, multi] = gsm ? [160, 153] : [70, 67]
  return text.length <= single ? 1 : Math.ceil(text.length / multi)
}
