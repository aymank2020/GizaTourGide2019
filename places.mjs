export const places = [
  {
    id: "giza",
    ar: "أهرامات الجيزة",
    en: "Giza Pyramids",
    areaAr: "الجيزة",
    areaEn: "Giza",
    arSummary: "مجموعة أهرامات خوفو وخفرع ومنكاورع على هضبة الجيزة.",
    enSummary:
      "The pyramid complex of Khufu, Khafre and Menkaure on the Giza plateau.",
    source: "https://egymonuments.gov.eg/en/archaeological-sites/giza-plateau/",
  },
  {
    id: "saqqara",
    ar: "سقارة",
    en: "Saqqara",
    areaAr: "جنوب الجيزة",
    areaEn: "South of Giza",
    arSummary: "جبانة ممفيس التي تضم مجمع هرم زوسر المدرج.",
    enSummary:
      "The necropolis of Memphis, including Djoser’s Step Pyramid complex.",
    source: "https://egymonuments.gov.eg/archaeological-sites/saqqara/",
  },
  {
    id: "dahshur",
    ar: "دهشور",
    en: "Dahshur",
    areaAr: "جنوب الجيزة",
    areaEn: "South of Giza",
    arSummary: "موقع أثري يضم الهرم المنحني والهرم الأحمر للملك سنفرو.",
    enSummary: "An archaeological site with Sneferu’s Bent and Red Pyramids.",
    source: "https://egymonuments.gov.eg/archaeological-sites/dahshur/",
  },
  {
    id: "gem",
    ar: "المتحف المصري الكبير",
    en: "Grand Egyptian Museum",
    areaAr: "الجيزة",
    areaEn: "Giza",
    arSummary: "متحف بالقرب من أهرامات الجيزة في ميدان الرماية.",
    enSummary: "A museum near the Giza Pyramids at El Remayah Square.",
    source:
      "https://www.experienceegypt.eg/en/attraction-details/346/the-grand-egyptian-museum-gem",
  },
];
export function filterPlaces(query = "", favorites = null) {
  const needle = query.trim().toLocaleLowerCase();
  return places.filter(
    (place) =>
      (!needle ||
        [place.ar, place.en, place.areaAr, place.areaEn].some((text) =>
          text.toLocaleLowerCase().includes(needle),
        )) &&
      (!favorites || favorites.has(place.id)),
  );
}
export function parseFavorites(text) {
  const value = JSON.parse(text);
  const known = new Set(places.map((place) => place.id));
  if (
    !Array.isArray(value) ||
    value.length > places.length ||
    value.some((id) => !known.has(id)) ||
    new Set(value).size !== value.length
  )
    throw new Error("Invalid favorites");
  return new Set(value);
}
