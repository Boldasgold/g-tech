import { BodyType } from "./vehicle3d";

export interface VwModelData {
  id: string;
  name: string;
  variant: string;
  generation: string;
  category: "Hatch" | "Sedan" | "SUV" | "Van" | "Picape";
  bodyType: BodyType;
  photoFile: string;
  photoUrl: string;
  years: string;
  engine: string;
  oilViscosity: string;
  oilCapacityLiters: number;
  oilNorm: string;
  tirePressureFrontPsi: number;
  tirePressureRearPsi: number;
  tirePressureLoadedPsi: number;
  sparkPlugsGapMm: number;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  keywords: string[];
}

export const VW_MODELS_CATALOG: VwModelData[] = [
  // 1-14: Golf Family
  {
    id: "golf-i",
    name: "Golf I (MK1)",
    variant: "1.5 GLS / GTI Clássico",
    generation: "Geração I (1974 - 1983)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-i.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-i.jpg",
    years: "1974-1983",
    engine: "1.5L 8V Carburado / 1.6 EG GTI",
    oilViscosity: "15W40 Mineral / 20W50",
    oilCapacityLiters: 3.5,
    oilNorm: "VW 501 01 (API SF/SG)",
    tirePressureFrontPsi: 28,
    tirePressureRearPsi: 28,
    tirePressureLoadedPsi: 32,
    sparkPlugsGapMm: 0.7,
    author: "Rutger van der Maar",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:1977_Volkswagen_Golf_1.5_GLS_(52874696951).jpg",
    keywords: ["golf 1", "golf i", "golf mk1", "golf 1974", "golf 1977", "golf 1980"]
  },
  {
    id: "golf-ii",
    name: "Golf II (MK2)",
    variant: "1.8 GL / GTI 16V",
    generation: "Geração II (1983 - 1992)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-ii.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-ii.jpg",
    years: "1983-1992",
    engine: "1.8L 8V / 1.8 16V KR",
    oilViscosity: "15W40 Mineral / 10W40 Semi-Sintético",
    oilCapacityLiters: 4.0,
    oilNorm: "VW 501 01 / 505 00",
    tirePressureFrontPsi: 29,
    tirePressureRearPsi: 29,
    tirePressureLoadedPsi: 33,
    sparkPlugsGapMm: 0.8,
    author: "Fleshgrinder",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_II_1991.jpg",
    keywords: ["golf 2", "golf ii", "golf mk2", "golf 1984", "golf 1988", "golf 1991"]
  },
  {
    id: "golf-iii",
    name: "Golf III (MK3)",
    variant: "2.0 GLX / GTI 2.0 8V",
    generation: "Geração III (1991 - 1998)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-iii.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-iii.jpg",
    years: "1991-1998",
    engine: "2.0L 8V Fluxo Cruzado (ABA / 2E)",
    oilViscosity: "10W40 Semi-Sintético / 15W40",
    oilCapacityLiters: 4.0,
    oilNorm: "VW 502 00 (API SJ)",
    tirePressureFrontPsi: 30,
    tirePressureRearPsi: 30,
    tirePressureLoadedPsi: 34,
    sparkPlugsGapMm: 0.8,
    author: "Charles from Port Chester, New York",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_III_GTI_(1996)_(55082249962).jpg",
    keywords: ["golf 3", "golf iii", "golf mk3", "golf glx", "golf 1994", "golf 1995", "golf 1996", "golf 1997"]
  },
  {
    id: "golf-iv",
    name: "Golf IV (MK4 / Sapão)",
    variant: "1.6 EA111 / 2.0 8V / 1.8 20V Turbo",
    generation: "Geração IV (1997 - 2007)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-iv.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-iv.jpg",
    years: "1997-2007",
    engine: "1.6 8V EA111 / 2.0 APK / 1.8T 20V 150/180cv",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 505 00",
    tirePressureFrontPsi: 30,
    tirePressureRearPsi: 29,
    tirePressureLoadedPsi: 34,
    sparkPlugsGapMm: 0.8,
    author: "DieselFordMondeo",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:1998_Volkswagen_Golf_S_1.4_%28Front%29.jpg",
    keywords: ["golf 4", "golf iv", "golf sapao", "golf sapão", "golf mk4", "golf 1.6", "golf 2.0", "golf 1.8t", "golf 2000", "golf 2002", "golf 2004"]
  },
  {
    id: "golf-v",
    name: "Golf V (MK5)",
    variant: "2.0 FSI / 1.4 TSI Twincharger",
    generation: "Geração V (2003 - 2008)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-v.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-v.jpg",
    years: "2003-2008",
    engine: "2.0 FSI 150cv / 1.4 TSI 140/170cv",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.6,
    oilNorm: "VW 502 00 / 504 00",
    tirePressureFrontPsi: 31,
    tirePressureRearPsi: 30,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "MichalPL",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_V.jpg",
    keywords: ["golf 5", "golf v", "golf mk5", "golf 2005", "golf 2006", "golf 2007", "golf fsi"]
  },
  {
    id: "golf-vi",
    name: "Golf VI (MK6)",
    variant: "1.4 TSI / 2.0 TSI",
    generation: "Geração VI (2008 - 2012)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-vi.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-vi.jpg",
    years: "2008-2012",
    engine: "1.4 TSI 122/160cv / 2.0 TSI EA888 Gen 1/2",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.6,
    oilNorm: "VW 502 00 / 504 00",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 31,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "JamesYoung8167",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_VI_Xiamen_01_2022-07-14.jpg",
    keywords: ["golf 6", "golf vi", "golf mk6", "golf 2009", "golf 2010", "golf 2011", "golf 2012"]
  },
  {
    id: "golf-vii",
    name: "Golf VII (MK7)",
    variant: "1.4 TSI BlueMotion / 1.0 TSI",
    generation: "Geração VII (2012 - 2020)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-vii.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-vii.jpg",
    years: "2012-2020",
    engine: "1.4 16V TSI EA211 (140/150cv) / 1.0 TSI (125cv)",
    oilViscosity: "5W40 / 0W20 100% Sintético Maxi Performance",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 31,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "JamesYoung8167",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_VII_Sanming_01_2022-08-12.jpg",
    keywords: ["golf 7", "golf vii", "golf mk7", "golf tsi", "golf 1.4", "golf 1.4 tsi", "golf highline", "golf comfortline", "golf 2014", "golf 2015", "golf 2016", "golf 2017", "golf 2018"]
  },
  {
    id: "golf-gti",
    name: "Golf VII GTI",
    variant: "2.0 TSI DSG 220cv / 230cv",
    generation: "Geração VII (2013 - 2020)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-gti.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-gti.jpg",
    years: "2013-2020",
    engine: "2.0 TSI EA888 Gen 3 Turbo Injeção Direta + Indireta (220/230cv)",
    oilViscosity: "5W40 100% Sintético Especial Alta Performance",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 508 88 (API SP / ACEA A3/B4)",
    tirePressureFrontPsi: 34,
    tirePressureRearPsi: 34,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0.7,
    author: "Tokumeigakarinoaoshima",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_VII_GTI_front.JPG",
    keywords: ["golf gti", "gti", "golf 7 gti", "golf vii gti", "golf gti dsg", "golf gti 2.0"]
  },
  {
    id: "golf-r",
    name: "Golf R 4Motion",
    variant: "2.0 TSI 300cv 4Motion",
    generation: "Geração VII (2014 - 2020)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-r.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-r.jpg",
    years: "2014-2020",
    engine: "2.0 TSI EA888 High-Output (300/310cv) Tração Integral",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 504 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 36,
    tirePressureLoadedPsi: 40,
    sparkPlugsGapMm: 0.65,
    author: "Charles from Port Chester, New York",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_VII_R_(2016)_(52184513529).jpg",
    keywords: ["golf r", "golf r 4motion", "golf 7 r", "golf vii r", "golf r 300cv"]
  },
  {
    id: "golf-alltrack",
    name: "Golf Alltrack",
    variant: "1.8 TSI / 2.0 TDI 4Motion Crossover",
    generation: "Geração VII (2015 - 2020)",
    category: "SUV",
    bodyType: "suv",
    photoFile: "golf-alltrack.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-alltrack.jpg",
    years: "2015-2020",
    engine: "1.8 TSI EA888 (170cv) / 2.0 TDI",
    oilViscosity: "5W30 / 5W40 Sintético",
    oilCapacityLiters: 5.5,
    oilNorm: "VW 502 00 / 504 00",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 33,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0.8,
    author: "Alexander Migl",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_Alltrack_(2016)_IMG_5571.jpg",
    keywords: ["golf alltrack", "alltrack", "golf perua 4x4", "golf 4motion"]
  },
  {
    id: "golf-cabriolet",
    name: "Golf Cabriolet",
    variant: "1.4 TSI Conversível",
    generation: "Geração VI (2011 - 2016)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-cabriolet.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-cabriolet.jpg",
    years: "2011-2016",
    engine: "1.4 TSI 122/160cv Capota Eletro-Hidráulica",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 31,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "Thomas doerfer",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Golf_VI_Cabriolet_1.4_TSI_Deeppurple_geschlossen.JPG",
    keywords: ["golf cabriolet", "golf conversivel", "golf conversível", "golf cabrio"]
  },
  {
    id: "golf-plus",
    name: "Golf Plus",
    variant: "1.6 / 1.9 TDI Monovolume",
    generation: "2005 - 2014",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-plus.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-plus.jpg",
    years: "2005-2014",
    engine: "1.6 8V / 1.4 TSI / 1.9 TDI",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 505 00",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2005_Volkswagen_Golf_Plus_SE_1.6.jpg",
    keywords: ["golf plus", "plus"]
  },
  {
    id: "golf-sportsvan",
    name: "Golf Sportsvan",
    variant: "1.5 TSI Evo / 1.4 TSI",
    generation: "2014 - 2020",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "golf-sportsvan.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-sportsvan.jpg",
    years: "2014-2020",
    engine: "1.4 TSI / 1.5 TSI Evo BlueMotion",
    oilViscosity: "0W20 / 5W30 Sintético",
    oilCapacityLiters: 4.3,
    oilNorm: "VW 508 00 / 504 00",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Golf_Sportsvan_GT_TSi_BlueMotion_1.5_Front.jpg",
    keywords: ["golf sportsvan", "sportsvan"]
  },
  {
    id: "golf-variant-sportwagen",
    name: "Golf Variant / SportWagen",
    variant: "1.4 TSI / 2.0 TDI Station Wagon",
    generation: "Geração VII (2013 - 2020)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "golf-variant-sportwagen.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/golf-variant-sportwagen.jpg",
    years: "2013-2020",
    engine: "1.4 TSI EA211 (140/150cv) Perua",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 33,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0.8,
    author: "Nozilla",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Golf_VII_Variant.jpg",
    keywords: ["golf variant", "golf perua", "golf sportwagen", "sportwagen"]
  },
  {
    id: "e-golf",
    name: "e-Golf 100% Elétrico",
    variant: "Bateria 24.2 kWh / 115cv",
    generation: "Fase 1 (2014 - 2016)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "e-golf.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/e-golf.jpg",
    years: "2014-2016",
    engine: "Motor Elétrico Síncrono 85kW (115cv) / 270Nm",
    oilViscosity: "Fluido Transmissão Elétrica G 052 171",
    oilCapacityLiters: 1.0,
    oilNorm: "VW G 052 171 A2",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 36,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0,
    author: "Elise240SX",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_e-Golf_Comfortline_in_Tungsten_Silver_Metallic,_front_left,_2022-06-13.jpg",
    keywords: ["e-golf", "egolf", "golf eletrico", "golf elétrico"]
  },
  {
    id: "e-golf-2017",
    name: "e-Golf (Facelift)",
    variant: "Bateria 35.8 kWh / 136cv",
    generation: "Fase 2 (2017 - 2020)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "e-golf-2017.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/e-golf-2017.jpg",
    years: "2017-2020",
    engine: "Motor Elétrico Síncrono 100kW (136cv) / 290Nm",
    oilViscosity: "Fluido Transmissão Redutora G 052 171",
    oilCapacityLiters: 1.0,
    oilNorm: "VW G 052 171 A2",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 36,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0,
    author: "Bull-Doser",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:%2717_Volkswagen_e-Golf_%28MIAS_2017%29.jpg",
    keywords: ["e-golf 2017", "egolf 2017", "e-golf facelift"]
  },

  // 15-28: Sedans, Fastbacks & Coupés
  {
    id: "jetta",
    name: "Jetta Sedã",
    variant: "1.4 TSI / 2.0 TSI Highline",
    generation: "Geração VI & VII (2011 - 2024)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "jetta.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/jetta.jpg",
    years: "2011-2024",
    engine: "1.4 16V TSI (150cv) / 2.0 TSI (200/211cv)",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "OSX",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2015_Volkswagen_Jetta_%281B_MY15%29_118TSI_Comfortline_sedan_%282015-08-07%29_01.jpg",
    keywords: ["jetta", "jetta tsi", "jetta 2.0", "jetta 1.4", "jetta highline", "jetta comfortline", "jetta trendline"]
  },
  {
    id: "jetta-gli",
    name: "Jetta GLI 350 TSI",
    variant: "2.0 TSI 230cv DSG 7",
    generation: "Geração VII (2019 - 2024)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "jetta-gli.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/jetta-gli.jpg",
    years: "2019-2024",
    engine: "2.0 16V TSI EA888 Gen 3 (230cv) / Câmbio DSG DQ381",
    oilViscosity: "5W40 / 0W20 100% Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 35,
    tirePressureRearPsi: 35,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0.7,
    author: "Alistair Fernandez",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Jetta_GLI_2017_Front.jpg",
    keywords: ["jetta gli", "gli", "jetta 350 tsi", "jetta gli 350", "jetta gli 2.0"]
  },
  {
    id: "passat",
    name: "Passat Sedã",
    variant: "2.0 TSI R-Line DSG",
    generation: "Geração B8 (2015 - 2024)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "passat.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/passat.jpg",
    years: "2015-2024",
    engine: "2.0 TSI EA888 Gen 3 (220cv) / DSG 6",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 34,
    tirePressureRearPsi: 33,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2019_Volkswagen_Passat_R-Line_TDi_2.0_Front.jpg",
    keywords: ["passat", "passat b8", "passat tsi", "passat r-line", "passat highline"]
  },
  {
    id: "passat-cc",
    name: "Passat CC Coupé 4 Portas",
    variant: "2.0 TSI / 3.6 V6 FSI 300cv",
    generation: "2008 - 2012",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "passat-cc.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/passat-cc.jpg",
    years: "2008-2012",
    engine: "2.0 TSI (200/211cv) ou 3.6 VR6 24V (300cv) 4Motion",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 5.5,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 35,
    tirePressureRearPsi: 34,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0.8,
    author: "Thomas doerfer",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Passat_CC_2.0_TDI_DSG_Reflexsilber.JPG",
    keywords: ["passat cc", "passat coupe", "passat v6", "passat cc v6"]
  },
  {
    id: "cc",
    name: "Volkswagen CC",
    variant: "2.0 TSI / 3.6 V6",
    generation: "Facelift (2012 - 2017)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "cc.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/cc.jpg",
    years: "2012-2017",
    engine: "2.0 TSI EA888 (211cv) / 3.6 VR6 (300cv)",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 5.5,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 35,
    tirePressureRearPsi: 34,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0.8,
    author: "OSX",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2013_Volkswagen_CC_(3CC_MY13.5)_130TDI_sedan_(2015-11-11)_01.jpg",
    keywords: ["volkswagen cc", "vw cc", "cc tsi"]
  },
  {
    id: "passat-variant",
    name: "Passat Variant",
    variant: "2.0 TSI Station Wagon",
    generation: "Geração B8 (2015 - 2024)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "passat-variant.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/passat-variant.jpg",
    years: "2015-2024",
    engine: "2.0 TSI EA888 Gen 3 (220cv) Perua de Luxo",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 34,
    tirePressureRearPsi: 35,
    tirePressureLoadedPsi: 40,
    sparkPlugsGapMm: 0.8,
    author: "OSX",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2015_Volkswagen_Passat_%283G_MY16%29_132TSI_station_wagon_%282015-11-11%29_01.jpg",
    keywords: ["passat variant", "passat perua"]
  },
  {
    id: "passat-nms",
    name: "Passat NMS",
    variant: "1.8 TSI / 2.5 5 Cilindros",
    generation: "Versão Norte-Americana (2012 - 2022)",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "passat-nms.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/passat-nms.jpg",
    years: "2012-2022",
    engine: "1.8 TSI / 2.5L 20V 5 Cilindros / 2.0 TSI",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 5.8,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 33,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "U.S. National Highway Traffic Safety Administration",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2012_Volkswagen_Passat_--_NHTSA_1.jpg",
    keywords: ["passat nms", "passat americano"]
  },
  {
    id: "arteon",
    name: "Arteon Gran Turismo Fastback",
    variant: "2.0 TSI Elegance / R-Line 280cv 4Motion",
    generation: "2017 - 2024",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "arteon.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/arteon.jpg",
    years: "2017-2024",
    engine: "2.0 TSI EA888 Gen 3/4 (190cv / 280cv) DSG 7",
    oilViscosity: "0W20 / 5W30 Sintético LongLife IV",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 508 00 / 504 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 35,
    tirePressureLoadedPsi: 40,
    sparkPlugsGapMm: 0.7,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Arteon_2.0.jpg",
    keywords: ["arteon", "vw arteon", "arteon r-line", "arteon fastback"]
  },
  {
    id: "arteon-shooting-brake",
    name: "Arteon Shooting Brake",
    variant: "2.0 TSI R Shooting Brake 320cv",
    generation: "2020 - 2024",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "arteon-shooting-brake.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/arteon-shooting-brake.jpg",
    years: "2020-2024",
    engine: "2.0 TSI Evo4 (280/320cv) R 4Motion",
    oilViscosity: "0W20 / 0W30 Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 508 00 / 504 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 36,
    tirePressureLoadedPsi: 41,
    sparkPlugsGapMm: 0.7,
    author: "Alexander Migl",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Arteon_Shooting_Brake_IMG_0019.jpg",
    keywords: ["arteon shooting brake", "shooting brake", "arteon perua"]
  },
  {
    id: "bora",
    name: "Bora Sedã",
    variant: "2.0 8V Gasolina / Flex",
    generation: "1999 - 2011",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "bora.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/bora.jpg",
    years: "1999-2011",
    engine: "2.0L 8V Fluxo Cruzado (APK / BBX / BPA) 116cv",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 30,
    tirePressureRearPsi: 30,
    tirePressureLoadedPsi: 34,
    sparkPlugsGapMm: 0.8,
    author: "OSX",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:1999-2001_Volkswagen_Bora_%281J%29_sedan_01.jpg",
    keywords: ["bora", "vw bora", "bora 2.0", "bora automatico"]
  },
  {
    id: "bora-variant",
    name: "Bora Variant",
    variant: "2.0 8V / 1.9 TDI Perua",
    generation: "1999 - 2005",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "bora-variant.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/bora-variant.jpg",
    years: "1999-2005",
    engine: "2.0 8V / 1.8 Turbo 20V / 1.9 TDI",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 505 00",
    tirePressureFrontPsi: 31,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "Rudolf Stricker",
    license: "CC BY-SA 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Bora_Variant_front_20071030.jpg",
    keywords: ["bora variant", "bora perua"]
  },
  {
    id: "phaeton",
    name: "Phaeton Sedã de Superluxo",
    variant: "3.2 V6 / 4.2 V8 / 6.0 W12 450cv",
    generation: "2002 - 2016",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "phaeton.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/phaeton.jpg",
    years: "2002-2016",
    engine: "4.2 V8 40V (335cv) / 6.0 W12 48V (450cv) 4Motion",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 8.5,
    oilNorm: "VW 502 00 / 505 01",
    tirePressureFrontPsi: 38,
    tirePressureRearPsi: 38,
    tirePressureLoadedPsi: 42,
    sparkPlugsGapMm: 0.7,
    author: "Bewibble at English Wikipedia",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2005_VW_Phaeton.jpg",
    keywords: ["phaeton", "vw phaeton", "phaeton w12", "phaeton v8"]
  },
  {
    id: "polo-seda",
    name: "Polo Sedã / Virtus",
    variant: "1.6 8V / 1.6 16V MSI / 200 TSI",
    generation: "2002 - 2024",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "polo-seda.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/polo-seda.jpg",
    years: "2002-2024",
    engine: "1.6 8V EA111 / 1.6 16V MSI / 1.0 200 TSI EA211",
    oilViscosity: "5W40 100% Sintético Maxi Performance",
    oilCapacityLiters: 4.0,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 30,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "Juanmbarba",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Vw_vento_polo_sedan.png",
    keywords: ["polo seda", "polo sedã", "polo sedan", "virtus", "polo classic", "vento"]
  },
  {
    id: "eos",
    name: "Eos Coupé-Cabriolet",
    variant: "2.0 TSI Teto Rígido Retrátil",
    generation: "2006 - 2015",
    category: "Sedan",
    bodyType: "sedan",
    photoFile: "eos.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/eos.jpg",
    years: "2006-2015",
    engine: "2.0 TSI EA888 (200/211cv) / Teto CSC de Vidro",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.8,
    author: "OSX",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2007_Volkswagen_Eos_(1F_MY08)_2.0_TDI_convertible_(2015-06-27).jpg",
    keywords: ["eos", "vw eos", "eos tsi", "eos conversivel"]
  },

  // 29-37: Compact Hatches & Coupés
  {
    id: "polo-hatch",
    name: "Polo Hatch / Track / GTS",
    variant: "1.0 MPI / 1.0 TSI / 1.4 250 TSI GTS",
    generation: "2002 - 2024",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "polo-hatch.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/polo-hatch.jpg",
    years: "2002-2024",
    engine: "1.0 12V MPI / 1.0 200 TSI (128cv) / 1.4 TSI GTS (150cv)",
    oilViscosity: "5W40 100% Sintético / 0W20 Maxi Performance",
    oilCapacityLiters: 4.0,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 30,
    tirePressureLoadedPsi: 34,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2011_Volkswagen_Polo_S_60_1.2_Front.jpg",
    keywords: ["polo", "polo hatch", "polo track", "polo tsi", "polo msi", "polo gts", "novo polo", "polo 1.6", "polo 1.0"]
  },
  {
    id: "up",
    name: "Up! / Up TSI",
    variant: "1.0 MPI / 1.0 TSI Turbo Flex",
    generation: "2014 - 2021",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "up.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/up.jpg",
    years: "2014-2021",
    engine: "1.0 12V 3 Cilindros EA211 (MPI 82cv / TSI Turbo 105cv)",
    oilViscosity: "5W40 100% Sintético Maxi Performance 502.00",
    oilCapacityLiters: 3.3,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 32,
    tirePressureRearPsi: 29,
    tirePressureLoadedPsi: 34,
    sparkPlugsGapMm: 0.8,
    author: "TuRbO_J from Adelaide, Australia",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2012_Volkswagen_Up!_(8134159319).jpg",
    keywords: ["up", "up!", "up tsi", "move up", "take up", "high up", "cross up", "speed up", "connect up"]
  },
  {
    id: "e-up",
    name: "e-Up! 100% Elétrico",
    variant: "Bateria 18.7 / 32.3 kWh",
    generation: "2013 - 2023",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "e-up.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/e-up.jpg",
    years: "2013-2023",
    engine: "Motor Elétrico 60kW (82cv) / 210Nm",
    oilViscosity: "Fluido Transmissão Redutora G 052 171",
    oilCapacityLiters: 0.9,
    oilNorm: "VW G 052 171",
    tirePressureFrontPsi: 35,
    tirePressureRearPsi: 35,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0,
    author: "C messier",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_e-up_in_Amsterdam_2962.jpg",
    keywords: ["e-up", "eup", "e-up!", "up eletrico"]
  },
  {
    id: "beetle",
    name: "Beetle / Novo Fusca TSI",
    variant: "2.0 TSI 200cv / 211cv DSG",
    generation: "A5 (2012 - 2019)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "beetle.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/beetle.jpg",
    years: "2012-2019",
    engine: "2.0 16V TSI EA888 (200/211cv) / Câmbio DSG 6",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 31,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "M 93",
    license: "CC BY-SA 3.0 de",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Beetle_1.4_TSI_Sport_%E2%80%93_Frontansicht%2C_3._M%C3%A4rz_2013%2C_D%C3%BCsseldorf.jpg",
    keywords: ["beetle", "fusca", "fusca tsi", "novo fusca", "new beetle", "fusca 2.0"]
  },
  {
    id: "beetle-cabriolet",
    name: "Beetle Cabriolet",
    variant: "2.0 TSI Conversível R-Line",
    generation: "A5 Conversível (2013 - 2019)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "beetle-cabriolet.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/beetle-cabriolet.jpg",
    years: "2013-2019",
    engine: "2.0 TSI EA888 (211cv) Capota Eletro-Hidráulica",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 35,
    sparkPlugsGapMm: 0.8,
    author: "M 93",
    license: "CC BY-SA 3.0 de",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Beetle_Cabriolet_1.4_TSI_Sport_R-Line_%28II%29_%E2%80%93_Heckansicht%2C_1._Juni_2013%2C_Ratingen.jpg",
    keywords: ["beetle cabriolet", "fusca conversivel", "fusca cabriolet"]
  },
  {
    id: "scirocco",
    name: "Scirocco Coupé Esportivo",
    variant: "2.0 TSI / Scirocco R 265cv",
    generation: "Geração III (2008 - 2017)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "scirocco.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/scirocco.jpg",
    years: "2008-2017",
    engine: "2.0 TSI EA888 (200/211cv) / 2.0 R (265/280cv)",
    oilViscosity: "5W40 Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 34,
    tirePressureRearPsi: 32,
    tirePressureLoadedPsi: 36,
    sparkPlugsGapMm: 0.7,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2015_Volkswagen_Scirocco_GT_BlueMotion_Tech_2.0.jpg",
    keywords: ["scirocco", "vw scirocco", "scirocco r"]
  },
  {
    id: "lupo",
    name: "Lupo Compacto",
    variant: "1.0 / 1.4 16V / GTI",
    generation: "1998 - 2005",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "lupo.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/lupo.jpg",
    years: "1998-2005",
    engine: "1.0 8V (50cv) / 1.4 16V (75/100cv) / 1.6 GTI (125cv)",
    oilViscosity: "10W40 / 5W40 Sintético",
    oilCapacityLiters: 3.2,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 30,
    tirePressureRearPsi: 28,
    tirePressureLoadedPsi: 33,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2002_Volkswagen_Lupo_E_1.0_Front_%281%29.jpg",
    keywords: ["lupo", "vw lupo"]
  },
  {
    id: "lupo-3l",
    name: "Lupo 3L TDI Ultra-Econômico",
    variant: "1.2 TDI Turbodiesel 3 Litros/100km",
    generation: "1999 - 2005",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "lupo-3l.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/lupo-3l.jpg",
    years: "1999-2005",
    engine: "1.2 TDI 3 Cilindros Turbodiesel Bloco de Magnésio/Alumínio",
    oilViscosity: "5W30 / 0W30 Sintético 506.01",
    oilCapacityLiters: 3.8,
    oilNorm: "VW 506 01",
    tirePressureFrontPsi: 38,
    tirePressureRearPsi: 38,
    tirePressureLoadedPsi: 41,
    sparkPlugsGapMm: 0,
    author: "Bubinator",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lupo_3L_TDI_Fahrerseite_Front.JPG",
    keywords: ["lupo 3l", "lupo tdi"]
  },
  {
    id: "id-3",
    name: "ID.3 100% Elétrico",
    variant: "Pure / Pro / Pro S (45, 58 e 77 kWh)",
    generation: "Plataforma MEB (2020 - 2024)",
    category: "Hatch",
    bodyType: "hatch",
    photoFile: "id-3.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/id-3.jpg",
    years: "2020-2024",
    engine: "Motor Elétrico Traseiro APP310 (150/204cv) / 310Nm",
    oilViscosity: "Fluido Transmissão Redutora G 055 549 A2",
    oilCapacityLiters: 1.1,
    oilNorm: "VW G 055 549",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 38,
    tirePressureLoadedPsi: 42,
    sparkPlugsGapMm: 0,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2020_Volkswagen_ID.3_1st_Front.jpg",
    keywords: ["id.3", "id3", "vw id3", "id 3", "eletrico id3"]
  },

  // 38-42: SUVs & Crossovers
  {
    id: "tiguan",
    name: "Tiguan / Allspace / R-Line",
    variant: "1.4 TSI 150cv / 2.0 TSI 220cv 350 TSI 4Motion",
    generation: "Geração II (2016 - 2024)",
    category: "SUV",
    bodyType: "suv",
    photoFile: "tiguan.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/tiguan.jpg",
    years: "2016-2024",
    engine: "2.0 TSI 350 TSI (220cv) / 1.4 TSI (150cv) Tração 4Motion",
    oilViscosity: "5W40 100% Sintético Maxi Performance",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 502 00 / 508 88",
    tirePressureFrontPsi: 35,
    tirePressureRearPsi: 35,
    tirePressureLoadedPsi: 41,
    sparkPlugsGapMm: 0.75,
    author: "© M 93",
    license: "CC BY-SA 3.0 de",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Tiguan_2.0_TSI_BlueMotion_Technology_4MOTION_Sound_%28II%29_%E2%80%93_Frontansicht%2C_24._Dezember_2017%2C_D%C3%BCsseldorf.jpg",
    keywords: ["tiguan", "tiguan allspace", "tiguan r-line", "tiguan 350 tsi", "tiguan 2.0", "tiguan 1.4", "allspace", "t-cross", "taos", "nivus"]
  },
  {
    id: "tiguan-5n-referencia-para-limited",
    name: "Tiguan 5N (Primeira Geração / Limited)",
    variant: "2.0 TSI 200cv 4Motion Tiptronic",
    generation: "Geração 5N (2007 - 2016)",
    category: "SUV",
    bodyType: "suv",
    photoFile: "tiguan-5n-referencia-para-limited.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/tiguan-5n-referencia-para-limited.jpg",
    years: "2007-2016",
    engine: "2.0 16V TSI EA888 Gen 1 (200cv) Câmbio Tiptronic 6 Marchas",
    oilViscosity: "5W40 100% Sintético",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 502 00",
    tirePressureFrontPsi: 33,
    tirePressureRearPsi: 33,
    tirePressureLoadedPsi: 38,
    sparkPlugsGapMm: 0.8,
    author: "M 93",
    license: "CC BY-SA 3.0 de",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VW_Tiguan_Track_%26_Field_%28Facelift%29_%E2%80%93_Frontansicht%2C_31._Dezember_2012%2C_Ratingen.jpg",
    keywords: ["tiguan 5n", "tiguan limited", "tiguan 2010", "tiguan 2011", "tiguan 2012", "tiguan 2013", "tiguan 2014"]
  },
  {
    id: "touareg",
    name: "Touareg SUV Premium",
    variant: "3.6 V6 FSI / 4.2 V8 / 3.0 V6 TDI",
    generation: "Geração I, II & III (2002 - 2024)",
    category: "SUV",
    bodyType: "suv",
    photoFile: "touareg.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/touareg.jpg",
    years: "2002-2024",
    engine: "3.6 VR6 FSI (280cv) / 4.2 V8 (350/360cv) / 3.0 V6 TDI (245cv)",
    oilViscosity: "5W40 / 5W30 Sintético LongLife",
    oilCapacityLiters: 6.9,
    oilNorm: "VW 502 00 / 505 01 / 507 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 38,
    tirePressureLoadedPsi: 44,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2015_Volkswagen_Touareg_V6_R-Line_TDi_BMT_3.0.jpg",
    keywords: ["touareg", "vw touareg", "touareg v6", "touareg v8", "touareg r-line"]
  },
  {
    id: "atlas",
    name: "Atlas / Teramont 7 Lugares",
    variant: "2.0 TSI / 3.6 VR6 4Motion",
    generation: "2017 - 2024",
    category: "SUV",
    bodyType: "suv",
    photoFile: "atlas.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/atlas.jpg",
    years: "2017-2024",
    engine: "2.0 TSI EA888 (238cv) / 3.6 VR6 24V (280cv)",
    oilViscosity: "0W20 / 5W30 Sintético",
    oilCapacityLiters: 5.7,
    oilNorm: "VW 508 00 / 502 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 36,
    tirePressureLoadedPsi: 42,
    sparkPlugsGapMm: 0.8,
    author: "Bull-Doser",
    license: "Public domain",
    licenseUrl: "",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Atlas_R_au_SIAM_2018.jpg",
    keywords: ["atlas", "vw atlas", "teramont"]
  },
  {
    id: "id-4",
    name: "ID.4 SUV 100% Elétrico",
    variant: "Pure / Pro / GTX Dual Motor AWD",
    generation: "Plataforma MEB (2021 - 2024)",
    category: "SUV",
    bodyType: "suv",
    photoFile: "id-4.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/id-4.jpg",
    years: "2021-2024",
    engine: "Elétrico Traseiro 204cv / GTX 2 Motores 299cv AWD",
    oilViscosity: "Fluido Transmissão Redutora G 055 549 A2",
    oilCapacityLiters: 1.5,
    oilNorm: "VW G 055 549",
    tirePressureFrontPsi: 38,
    tirePressureRearPsi: 41,
    tirePressureLoadedPsi: 44,
    sparkPlugsGapMm: 0,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2021_Volkswagen_ID.4_City_Rear.jpg",
    keywords: ["id.4", "id4", "vw id4", "id 4", "id.4 gtx"]
  },

  // 43-51: Vans, Utilitários & Comerciais
  {
    id: "crafter",
    name: "Crafter Furgão & Chassi",
    variant: "2.0 TDI Biturbo Commercial",
    generation: "2017 - 2024",
    category: "Van",
    bodyType: "van",
    photoFile: "crafter.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/crafter.jpg",
    years: "2017-2024",
    engine: "2.0 TDI EA288 Nutzfahrzeuge (102/140/177cv Biturbo)",
    oilViscosity: "5W30 100% Sintético DPF",
    oilCapacityLiters: 7.4,
    oilNorm: "VW 507 00 (ACEA C3)",
    tirePressureFrontPsi: 44,
    tirePressureRearPsi: 51,
    tirePressureLoadedPsi: 58,
    sparkPlugsGapMm: 0,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2017_Volkswagen_Crafter_CR35_Trendline_TD_2.0_Front.jpg",
    keywords: ["crafter", "vw crafter", "crafter van", "crafter furgao", "crafter furgão"]
  },
  {
    id: "e-crafter",
    name: "e-Crafter 100% Elétrico",
    variant: "Motor Elétrico 100kW (136cv) / 35.8 kWh",
    generation: "2018 - 2024",
    category: "Van",
    bodyType: "van",
    photoFile: "e-crafter.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/e-crafter.jpg",
    years: "2018-2024",
    engine: "Motor Elétrico 100kW (136cv) / 290Nm",
    oilViscosity: "Fluido Transmissão Redutora",
    oilCapacityLiters: 1.2,
    oilNorm: "VW G 052 171",
    tirePressureFrontPsi: 46,
    tirePressureRearPsi: 52,
    tirePressureLoadedPsi: 60,
    sparkPlugsGapMm: 0,
    author: "Alexander Migl",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_e-Crafter_IMG_3803.jpg",
    keywords: ["e-crafter", "ecrafter", "crafter eletrico", "crafter elétrico"]
  },
  {
    id: "transporter",
    name: "Transporter T6 / Kombi Moderna",
    variant: "2.0 TDI Caravelle / Multivan",
    generation: "T6 & T6.1 (2015 - 2024)",
    category: "Van",
    bodyType: "van",
    photoFile: "transporter.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/transporter.jpg",
    years: "2015-2024",
    engine: "2.0 TDI EA288 (102/150/199cv) DSG / 4Motion",
    oilViscosity: "5W30 100% Sintético DPF",
    oilCapacityLiters: 7.0,
    oilNorm: "VW 507 00",
    tirePressureFrontPsi: 42,
    tirePressureRearPsi: 45,
    tirePressureLoadedPsi: 50,
    sparkPlugsGapMm: 0,
    author: "User48PL",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Volkswagen_Transporter_T6_EDITION_30.jpg",
    keywords: ["transporter", "vw transporter", "t6", "kombi", "caravelle", "multivan", "transporter t6"]
  },
  {
    id: "caddy",
    name: "Caddy Furgão & Passageiros",
    variant: "1.4 TSI / 2.0 TDI Highline",
    generation: "2015 - 2024",
    category: "Van",
    bodyType: "van",
    photoFile: "caddy.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/caddy.jpg",
    years: "2015-2024",
    engine: "1.4 TSI EA211 (125/131cv) / 2.0 TDI (102/122cv)",
    oilViscosity: "5W30 / 5W40 Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 502 00 / 507 00",
    tirePressureFrontPsi: 36,
    tirePressureRearPsi: 38,
    tirePressureLoadedPsi: 44,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Caddy_C20_Highline_TDi_2.0_Front.jpg",
    keywords: ["caddy", "vw caddy", "caddy maxi"]
  },
  {
    id: "touran",
    name: "Touran Monovolume Familiar",
    variant: "1.4 TSI / 1.5 TSI / 2.0 TDI",
    generation: "Geração II (2015 - 2024)",
    category: "Van",
    bodyType: "van",
    photoFile: "touran.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/touran.jpg",
    years: "2015-2024",
    engine: "1.4 TSI / 1.5 TSI Evo (150cv) / 2.0 TDI",
    oilViscosity: "0W20 / 5W30 Sintético",
    oilCapacityLiters: 4.5,
    oilNorm: "VW 508 00 / 504 00",
    tirePressureFrontPsi: 34,
    tirePressureRearPsi: 34,
    tirePressureLoadedPsi: 39,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Touran_1.6.jpg",
    keywords: ["touran", "vw touran"]
  },
  {
    id: "sharan",
    name: "Sharan Minivan 7 Lugares",
    variant: "2.0 TSI / 2.0 TDI Portas Deslizantes",
    generation: "2010 - 2022",
    category: "Van",
    bodyType: "van",
    photoFile: "sharan.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/sharan.jpg",
    years: "2010-2022",
    engine: "2.0 TSI (200/220cv) / 2.0 TDI (140/177cv) DSG",
    oilViscosity: "5W30 / 5W40 Sintético DPF",
    oilCapacityLiters: 4.7,
    oilNorm: "VW 504 00 / 507 00",
    tirePressureFrontPsi: 38,
    tirePressureRearPsi: 40,
    tirePressureLoadedPsi: 46,
    sparkPlugsGapMm: 0.8,
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Sharan_SEL_BlueMotion_Technology_2.0.jpg",
    keywords: ["sharan", "vw sharan"]
  },
  {
    id: "tge-man",
    name: "TGE (MAN / Grupo VW)",
    variant: "2.0 TDI Caminhão Leve / Van 3.180",
    generation: "2017 - 2024",
    category: "Van",
    bodyType: "van",
    photoFile: "tge-man.jpg",
    photoUrl: "/img/vehicles/volkswagen/fotos/tge-man.jpg",
    years: "2017-2024",
    engine: "2.0 TDI Euro 6 (140cv / 177cv Biturbo) Plataforma Crafter",
    oilViscosity: "5W30 100% Sintético Pesado",
    oilCapacityLiters: 7.4,
    oilNorm: "VW 507 00 / MAN 3477",
    tirePressureFrontPsi: 48,
    tirePressureRearPsi: 55,
    tirePressureLoadedPsi: 62,
    sparkPlugsGapMm: 0,
    author: "JoachimKohler-HB",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:MAN_TGE_3.180_Kastenwagen.jpg",
    keywords: ["tge", "man tge", "tge man", "delivery", "caminhao leve vw"]
  }
];

// Helper to normalize strings for comparison
function cleanStr(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

export interface VehicleRecognitionResult {
  isVolkswagen: boolean;
  matchedModel: VwModelData | null;
  displayName: string;
  photoUrl: string;
  bodyType: BodyType;
  confidence: "exact" | "high" | "generation_inferred" | "fallback" | "other_brand";
  badgeText: string;
  categoryName: string;
  specs?: {
    engine: string;
    oilViscosity: string;
    oilCapacityLiters: number;
    oilNorm: string;
    tirePressureFrontPsi: number;
    tirePressureRearPsi: number;
    tirePressureLoadedPsi: number;
    sparkPlugsGapMm: number;
  };
}

export function recognizeVehicle(
  brand: string,
  model: string,
  bodyTypeHint?: string
): VehicleRecognitionResult {
  const normBrand = cleanStr(brand);
  const normModel = cleanStr(model);
  const combined = `${normBrand} ${normModel}`.trim();

  // Check if brand indicates Volkswagen or if model contains unmistakable VW keywords
  const isVwBrand =
    normBrand === "volkswagen" ||
    normBrand === "vw" ||
    normBrand === "volks" ||
    normBrand.startsWith("volks") ||
    normBrand.includes("vw");

  const vwModelNames = [
    "golf", "jetta", "passat", "polo", "up", "tiguan", "touareg",
    "arteon", "bora", "scirocco", "beetle", "fusca", "crafter",
    "transporter", "caddy", "touran", "sharan", "lupo", "eos",
    "phaeton", "atlas", "id 3", "id3", "id 4", "id4", "virtus",
    "voyage", "gol", "amarok", "saveiro", "nivus", "t cross", "taos", "fox"
  ];

  const containsVwModelName = vwModelNames.some(vw => normModel.includes(vw) || combined.includes(vw));

  // If NOT Volkswagen, respect prompt: "coloque todas essas fotos na parte apenas da volkswagen"
  if (!isVwBrand && !containsVwModelName) {
    let fallbackPhoto = "/img/vehicles/hatch-real.jpg";
    let bType: BodyType = (bodyTypeHint as BodyType) || "hatch";
    const l = combined;

    if (l.includes("duster")) {
      fallbackPhoto = "/img/vehicles/renault-duster.jpg";
      bType = "suv";
    } else if (l.includes("sandero") || l.includes("stepway") || l.includes("kwid")) {
      fallbackPhoto = "/img/vehicles/renault-sandero.jpg";
      bType = "hatch";
    } else if (l.includes("logan")) {
      fallbackPhoto = "/img/vehicles/renault-logan.jpg";
      bType = "sedan";
    } else if (l.includes("oroch")) {
      fallbackPhoto = "/img/vehicles/renault-oroch.jpg";
      bType = "picape";
    } else if (l.includes("master")) {
      fallbackPhoto = "/img/vehicles/renault-master.jpg";
      bType = "van";
    } else if (l.includes("onix")) {
      fallbackPhoto = "/img/vehicles/chevrolet-onix.jpg";
      bType = "hatch";
    } else if (bType === "suv") {
      fallbackPhoto = "/img/vehicles/suv-real.jpg";
    } else if (bType === "sedan") {
      fallbackPhoto = "/img/vehicles/sedan-real.jpg";
    } else if (bType === "picape") {
      fallbackPhoto = "/img/vehicles/picape-real.jpg";
    } else if (bType === "van") {
      fallbackPhoto = "/img/vehicles/van-real.jpg";
    }

    return {
      isVolkswagen: false,
      matchedModel: null,
      displayName: `${brand || "Veículo"} ${model || ""}`.trim(),
      photoUrl: fallbackPhoto,
      bodyType: bType,
      confidence: "other_brand",
      badgeText: `${brand || "Veículo"} (Outra Montadora)`,
      categoryName: bType.toUpperCase()
    };
  }

  // --- VOLKSWAGEN RECOGNITION (All 51 models) ---

  // 1. Specific Variant Priority Matches
  // Golf GTI
  if (normModel.includes("gti") || combined.includes("golf gti")) {
    const gti = VW_MODELS_CATALOG.find(m => m.id === "golf-gti")!;
    return buildVwResult(gti, "exact", "Volkswagen Golf VII GTI 2.0 TSI");
  }
  // Golf R
  if (normModel.includes("golf r") || normModel.includes(" r32") || normModel.includes("golf r32")) {
    const golfR = VW_MODELS_CATALOG.find(m => m.id === "golf-r")!;
    return buildVwResult(golfR, "exact", "Volkswagen Golf R 4Motion");
  }
  // Golf Alltrack
  if (normModel.includes("alltrack")) {
    const alltrack = VW_MODELS_CATALOG.find(m => m.id === "golf-alltrack")!;
    return buildVwResult(alltrack, "exact", "Volkswagen Golf Alltrack 4Motion");
  }
  // Golf Cabriolet
  if (normModel.includes("cabrio") && (normModel.includes("golf") || combined.includes("golf"))) {
    const cabrio = VW_MODELS_CATALOG.find(m => m.id === "golf-cabriolet")!;
    return buildVwResult(cabrio, "exact", "Volkswagen Golf Cabriolet");
  }
  // Golf Plus / Sportsvan
  if (normModel.includes("sportsvan")) {
    const svan = VW_MODELS_CATALOG.find(m => m.id === "golf-sportsvan")!;
    return buildVwResult(svan, "exact", "Volkswagen Golf Sportsvan");
  }
  if (normModel.includes("golf plus")) {
    const plus = VW_MODELS_CATALOG.find(m => m.id === "golf-plus")!;
    return buildVwResult(plus, "exact", "Volkswagen Golf Plus");
  }
  // Golf Variant / Sportwagen
  if (normModel.includes("variant") && (normModel.includes("golf") || combined.includes("golf"))) {
    const gvar = VW_MODELS_CATALOG.find(m => m.id === "golf-variant-sportwagen")!;
    return buildVwResult(gvar, "exact", "Volkswagen Golf Variant");
  }
  // e-Golf
  if (normModel.includes("e golf") || normModel.includes("egolf") || normModel.includes("golf eletrico") || normModel.includes("golf 2017")) {
    const egolf = VW_MODELS_CATALOG.find(m => m.id === "e-golf-2017") || VW_MODELS_CATALOG.find(m => m.id === "e-golf")!;
    return buildVwResult(egolf, "exact", "Volkswagen e-Golf 100% Elétrico");
  }

  // Golf Generations (I to VII)
  if (normModel.includes("golf")) {
    if (normModel.includes("mk1") || normModel.includes("golf 1") || normModel.includes("golf i ") || normModel.endsWith("golf i")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-i")!, "exact", "Volkswagen Golf I (MK1)");
    }
    if (normModel.includes("mk2") || normModel.includes("golf 2") || normModel.includes("golf ii ") || normModel.endsWith("golf ii")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-ii")!, "exact", "Volkswagen Golf II (MK2)");
    }
    if (normModel.includes("mk3") || normModel.includes("golf 3") || normModel.includes("golf iii") || normModel.includes("glx")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-iii")!, "exact", "Volkswagen Golf III (MK3)");
    }
    if (normModel.includes("mk4") || normModel.includes("golf 4") || normModel.includes("golf iv") || normModel.includes("sapao") || normModel.includes("sapao")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-iv")!, "exact", "Volkswagen Golf IV (MK4 Sapão)");
    }
    if (normModel.includes("mk5") || normModel.includes("golf 5") || normModel.includes("golf v ") || normModel.endsWith("golf v")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-v")!, "exact", "Volkswagen Golf V (MK5)");
    }
    if (normModel.includes("mk6") || normModel.includes("golf 6") || normModel.includes("golf vi ") || normModel.endsWith("golf vi")) {
      return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-vi")!, "exact", "Volkswagen Golf VI (MK6)");
    }
    // Default Golf (modern MK7 TSI)
    return buildVwResult(VW_MODELS_CATALOG.find(m => m.id === "golf-vii")!, "high", "Volkswagen Golf VII TSI");
  }

  // Jetta / Jetta GLI
  if (normModel.includes("gli") || combined.includes("jetta gli")) {
    const gli = VW_MODELS_CATALOG.find(m => m.id === "jetta-gli")!;
    return buildVwResult(gli, "exact", "Volkswagen Jetta GLI 350 TSI");
  }
  if (normModel.includes("jetta")) {
    const jetta = VW_MODELS_CATALOG.find(m => m.id === "jetta")!;
    return buildVwResult(jetta, "high", "Volkswagen Jetta TSI");
  }

  // Arteon / Arteon Shooting Brake
  if (normModel.includes("shooting brake")) {
    const asb = VW_MODELS_CATALOG.find(m => m.id === "arteon-shooting-brake")!;
    return buildVwResult(asb, "exact", "Volkswagen Arteon Shooting Brake");
  }
  if (normModel.includes("arteon")) {
    const art = VW_MODELS_CATALOG.find(m => m.id === "arteon")!;
    return buildVwResult(art, "high", "Volkswagen Arteon R-Line");
  }

  // Passat variants
  if (normModel.includes("passat cc")) {
    const pcc = VW_MODELS_CATALOG.find(m => m.id === "passat-cc")!;
    return buildVwResult(pcc, "exact", "Volkswagen Passat CC Coupé");
  }
  if (normModel.includes("passat variant")) {
    const pvar = VW_MODELS_CATALOG.find(m => m.id === "passat-variant")!;
    return buildVwResult(pvar, "exact", "Volkswagen Passat Variant");
  }
  if (normModel.includes("passat nms")) {
    const pnms = VW_MODELS_CATALOG.find(m => m.id === "passat-nms")!;
    return buildVwResult(pnms, "exact", "Volkswagen Passat NMS");
  }
  if (normModel.includes("passat")) {
    const passat = VW_MODELS_CATALOG.find(m => m.id === "passat")!;
    return buildVwResult(passat, "high", "Volkswagen Passat R-Line");
  }
  if (normModel === "cc" || normModel.includes("vw cc") || normModel.includes("volkswagen cc")) {
    const cc = VW_MODELS_CATALOG.find(m => m.id === "cc")!;
    return buildVwResult(cc, "exact", "Volkswagen CC");
  }

  // Bora / Bora Variant
  if (normModel.includes("bora variant")) {
    const bvar = VW_MODELS_CATALOG.find(m => m.id === "bora-variant")!;
    return buildVwResult(bvar, "exact", "Volkswagen Bora Variant");
  }
  if (normModel.includes("bora")) {
    const bora = VW_MODELS_CATALOG.find(m => m.id === "bora")!;
    return buildVwResult(bora, "high", "Volkswagen Bora 2.0");
  }

  // Beetle / Fusca
  if (normModel.includes("cabrio") && (normModel.includes("beetle") || normModel.includes("fusca"))) {
    const bcab = VW_MODELS_CATALOG.find(m => m.id === "beetle-cabriolet")!;
    return buildVwResult(bcab, "exact", "Volkswagen Beetle Cabriolet (Fusca Conversível)");
  }
  if (normModel.includes("beetle") || normModel.includes("fusca")) {
    const beetle = VW_MODELS_CATALOG.find(m => m.id === "beetle")!;
    return buildVwResult(beetle, "high", "Volkswagen Beetle (Fusca TSI)");
  }

  // Up! / e-Up
  if (normModel.includes("e up") || normModel.includes("eup")) {
    const eup = VW_MODELS_CATALOG.find(m => m.id === "e-up")!;
    return buildVwResult(eup, "exact", "Volkswagen e-Up! Elétrico");
  }
  if (normModel.includes("up")) {
    const up = VW_MODELS_CATALOG.find(m => m.id === "up")!;
    return buildVwResult(up, "high", "Volkswagen Up! TSI");
  }

  // Lupo / Lupo 3L
  if (normModel.includes("lupo 3l") || normModel.includes("3l")) {
    const l3l = VW_MODELS_CATALOG.find(m => m.id === "lupo-3l")!;
    return buildVwResult(l3l, "exact", "Volkswagen Lupo 3L TDI");
  }
  if (normModel.includes("lupo")) {
    const lupo = VW_MODELS_CATALOG.find(m => m.id === "lupo")!;
    return buildVwResult(lupo, "high", "Volkswagen Lupo");
  }

  // Polo Hatch vs Polo Sedã / Virtus
  if (normModel.includes("virtus") || normModel.includes("seda") || normModel.includes("sedan") || normModel.includes("classic")) {
    const pseda = VW_MODELS_CATALOG.find(m => m.id === "polo-seda")!;
    return buildVwResult(pseda, "high", "Volkswagen Polo Sedã / Virtus");
  }
  if (normModel.includes("polo")) {
    const phatch = VW_MODELS_CATALOG.find(m => m.id === "polo-hatch")!;
    return buildVwResult(phatch, "high", "Volkswagen Polo Hatch TSI");
  }

  // Tiguan / Touareg / Atlas
  if (normModel.includes("5n") || normModel.includes("limited")) {
    const t5n = VW_MODELS_CATALOG.find(m => m.id === "tiguan-5n-referencia-para-limited")!;
    return buildVwResult(t5n, "exact", "Volkswagen Tiguan 5N Limited");
  }
  if (normModel.includes("tiguan") || normModel.includes("allspace") || normModel.includes("taos") || normModel.includes("t cross") || normModel.includes("nivus")) {
    const tiguan = VW_MODELS_CATALOG.find(m => m.id === "tiguan")!;
    return buildVwResult(tiguan, "high", "Volkswagen Tiguan 350 TSI");
  }
  if (normModel.includes("touareg")) {
    const touareg = VW_MODELS_CATALOG.find(m => m.id === "touareg")!;
    return buildVwResult(touareg, "high", "Volkswagen Touareg V6 R-Line");
  }
  if (normModel.includes("atlas") || normModel.includes("teramont")) {
    const atlas = VW_MODELS_CATALOG.find(m => m.id === "atlas")!;
    return buildVwResult(atlas, "high", "Volkswagen Atlas 7 Lugares");
  }

  // ID.3 / ID.4
  if (normModel.includes("id 3") || normModel.includes("id3") || normModel.includes("id.3")) {
    const id3 = VW_MODELS_CATALOG.find(m => m.id === "id-3")!;
    return buildVwResult(id3, "exact", "Volkswagen ID.3 Elétrico");
  }
  if (normModel.includes("id 4") || normModel.includes("id4") || normModel.includes("id.4")) {
    const id4 = VW_MODELS_CATALOG.find(m => m.id === "id-4")!;
    return buildVwResult(id4, "exact", "Volkswagen ID.4 SUV Elétrico");
  }

  // Scirocco, Phaeton, Eos
  if (normModel.includes("scirocco")) {
    const scir = VW_MODELS_CATALOG.find(m => m.id === "scirocco")!;
    return buildVwResult(scir, "high", "Volkswagen Scirocco Coupé");
  }
  if (normModel.includes("phaeton")) {
    const phae = VW_MODELS_CATALOG.find(m => m.id === "phaeton")!;
    return buildVwResult(phae, "high", "Volkswagen Phaeton W12");
  }
  if (normModel.includes("eos")) {
    const eos = VW_MODELS_CATALOG.find(m => m.id === "eos")!;
    return buildVwResult(eos, "high", "Volkswagen Eos Conversível");
  }

  // Vans & Commercials (Crafter, Transporter, Caddy, Touran, Sharan, TGE)
  if (normModel.includes("e crafter") || normModel.includes("ecrafter")) {
    const ecrafter = VW_MODELS_CATALOG.find(m => m.id === "e-crafter")!;
    return buildVwResult(ecrafter, "exact", "Volkswagen e-Crafter Elétrico");
  }
  if (normModel.includes("crafter")) {
    const crafter = VW_MODELS_CATALOG.find(m => m.id === "crafter")!;
    return buildVwResult(crafter, "high", "Volkswagen Crafter Furgão");
  }
  if (normModel.includes("transporter") || normModel.includes("kombi") || normModel.includes("caravelle") || normModel.includes("multivan") || normModel.includes("t6")) {
    const transp = VW_MODELS_CATALOG.find(m => m.id === "transporter")!;
    return buildVwResult(transp, "high", "Volkswagen Transporter T6");
  }
  if (normModel.includes("caddy")) {
    const caddy = VW_MODELS_CATALOG.find(m => m.id === "caddy")!;
    return buildVwResult(caddy, "high", "Volkswagen Caddy Furgão");
  }
  if (normModel.includes("touran")) {
    const touran = VW_MODELS_CATALOG.find(m => m.id === "touran")!;
    return buildVwResult(touran, "high", "Volkswagen Touran Monovolume");
  }
  if (normModel.includes("sharan")) {
    const sharan = VW_MODELS_CATALOG.find(m => m.id === "sharan")!;
    return buildVwResult(sharan, "high", "Volkswagen Sharan Minivan");
  }
  if (normModel.includes("tge") || normModel.includes("man")) {
    const tge = VW_MODELS_CATALOG.find(m => m.id === "tge-man")!;
    return buildVwResult(tge, "high", "Volkswagen MAN TGE Comercial");
  }

  // Other Brazilian VW Models:
  if (normModel.includes("gol") || normModel.includes("fox")) {
    const phatch = VW_MODELS_CATALOG.find(m => m.id === "polo-hatch")!;
    return buildVwResult(phatch, "high", `Volkswagen ${model || "Gol"} (Hatch VW)`);
  }
  if (normModel.includes("voyage")) {
    const pseda = VW_MODELS_CATALOG.find(m => m.id === "polo-seda")!;
    return buildVwResult(pseda, "high", "Volkswagen Voyage (Sedã VW)");
  }
  if (normModel.includes("amarok") || normModel.includes("saveiro")) {
    return {
      isVolkswagen: true,
      matchedModel: null,
      displayName: `Volkswagen ${model || "Picape"}`,
      photoUrl: "/img/vehicles/picape-real.jpg",
      bodyType: "picape",
      confidence: "high",
      badgeText: `Volkswagen ${model} (Picape Homologada G-Tech)`,
      categoryName: "PICAPE",
      specs: {
        engine: "2.0 TDI Biturbo (180cv) / 3.0 V6 TDI (258cv)",
        oilViscosity: "5W30 100% Sintético DPF (VW 507 00)",
        oilCapacityLiters: 7.5,
        oilNorm: "VW 507 00 (ACEA C3)",
        tirePressureFrontPsi: 36,
        tirePressureRearPsi: 38,
        tirePressureLoadedPsi: 44,
        sparkPlugsGapMm: 0
      }
    };
  }

  // Default Volkswagen fallback (Golf VII TSI)
  const defaultVw = VW_MODELS_CATALOG.find(m => m.id === "golf-vii")!;
  return buildVwResult(defaultVw, "fallback", `Volkswagen ${model || "Modelo Reconhecido"}`);
}

function buildVwResult(
  model: VwModelData,
  confidence: "exact" | "high" | "generation_inferred" | "fallback",
  customDisplayName?: string
): VehicleRecognitionResult {
  return {
    isVolkswagen: true,
    matchedModel: model,
    displayName: customDisplayName || `Volkswagen ${model.name}`,
    photoUrl: model.photoUrl,
    bodyType: model.bodyType,
    confidence,
    badgeText: `Volkswagen Reconhecido: ${model.name} (${model.category})`,
    categoryName: model.category.toUpperCase(),
    specs: {
      engine: model.engine,
      oilViscosity: model.oilViscosity,
      oilCapacityLiters: model.oilCapacityLiters,
      oilNorm: model.oilNorm,
      tirePressureFrontPsi: model.tirePressureFrontPsi,
      tirePressureRearPsi: model.tirePressureRearPsi,
      tirePressureLoadedPsi: model.tirePressureLoadedPsi,
      sparkPlugsGapMm: model.sparkPlugsGapMm
    }
  };
}

