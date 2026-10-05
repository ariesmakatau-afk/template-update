// Photos for menu items that have one. Add a line here when a new product
// photo arrives (drop the file in /public/images first).
export const productPhotos: Record<string, { src: string; alt: string }> = {
  yiros: { src: "/images/yiros.jpg", alt: "A charcoal yiros wrapped in paper on the counter" },
  "ab-pack": { src: "/images/ab-pack.jpg", alt: "An AB Pack: charcoal meat over chips with sauces" },
  platter: { src: "/images/platters.jpg", alt: "Platters of charcoal meat, salad, chips and pita" },
  "greek-coffee": { src: "/images/greek-coffee.jpg", alt: "A Greek coffee in a meander cup" },
};

export const groupPhotos: Record<string, { src: string; alt: string }> = {
  yiros: productPhotos.yiros,
  "ab-pack": productPhotos["ab-pack"],
  platters: productPhotos.platter,
  coffee: productPhotos["greek-coffee"],
};
