// G-Tech Serviços Automotivos - Reconhecimento Inteligente Volkswagen (51 Modelos Oficiais)
(function() {
  const VW_MODELS = [
    { id: "golf-i", name: "Golf I (MK1)", photo: "golf-i.jpg", body: "hatch", keys: ["golf 1", "golf i", "golf mk1"] },
    { id: "golf-ii", name: "Golf II (MK2)", photo: "golf-ii.jpg", body: "hatch", keys: ["golf 2", "golf ii", "golf mk2"] },
    { id: "golf-iii", name: "Golf III (MK3)", photo: "golf-iii.jpg", body: "hatch", keys: ["golf 3", "golf iii", "golf mk3", "golf glx"] },
    { id: "golf-iv", name: "Golf IV (Sapão)", photo: "golf-iv.jpg", body: "hatch", keys: ["golf 4", "golf iv", "golf sapao", "golf sapão", "golf mk4"] },
    { id: "golf-v", name: "Golf V (MK5)", photo: "golf-v.jpg", body: "hatch", keys: ["golf 5", "golf v", "golf mk5"] },
    { id: "golf-vi", name: "Golf VI (MK6)", photo: "golf-vi.jpg", body: "hatch", keys: ["golf 6", "golf vi", "golf mk6"] },
    { id: "golf-vii", name: "Golf VII TSI", photo: "golf-vii.jpg", body: "hatch", keys: ["golf 7", "golf vii", "golf mk7", "golf tsi", "golf highline", "golf comfortline"] },
    { id: "golf-gti", name: "Golf VII GTI 2.0 TSI", photo: "golf-gti.jpg", body: "hatch", keys: ["golf gti", "gti", "golf 7 gti", "golf vii gti"] },
    { id: "golf-r", name: "Golf R 4Motion", photo: "golf-r.jpg", body: "hatch", keys: ["golf r", "golf r32", "golf 4motion"] },
    { id: "golf-alltrack", name: "Golf Alltrack", photo: "golf-alltrack.jpg", body: "suv", keys: ["golf alltrack", "alltrack"] },
    { id: "golf-cabriolet", name: "Golf Cabriolet", photo: "golf-cabriolet.jpg", body: "hatch", keys: ["golf cabriolet", "golf conversivel", "golf conversível", "golf cabrio"] },
    { id: "golf-plus", name: "Golf Plus", photo: "golf-plus.jpg", body: "hatch", keys: ["golf plus"] },
    { id: "golf-sportsvan", name: "Golf Sportsvan", photo: "golf-sportsvan.jpg", body: "hatch", keys: ["golf sportsvan", "sportsvan"] },
    { id: "golf-variant-sportwagen", name: "Golf Variant", photo: "golf-variant-sportwagen.jpg", body: "sedan", keys: ["golf variant", "golf perua", "golf sportwagen"] },
    { id: "e-golf", name: "e-Golf Elétrico", photo: "e-golf.jpg", body: "hatch", keys: ["e-golf", "egolf", "golf eletrico"] },
    { id: "e-golf-2017", name: "e-Golf (Facelift)", photo: "e-golf-2017.jpg", body: "hatch", keys: ["e-golf 2017", "egolf 2017"] },
    { id: "jetta-gli", name: "Jetta GLI 350 TSI", photo: "jetta-gli.jpg", body: "sedan", keys: ["jetta gli", "gli", "jetta 350"] },
    { id: "jetta", name: "Jetta Sedã", photo: "jetta.jpg", body: "sedan", keys: ["jetta", "jetta tsi", "jetta 2.0", "jetta 1.4"] },
    { id: "passat-cc", name: "Passat CC Coupé", photo: "passat-cc.jpg", body: "sedan", keys: ["passat cc", "cc v6"] },
    { id: "passat-variant", name: "Passat Variant", photo: "passat-variant.jpg", body: "sedan", keys: ["passat variant", "passat perua"] },
    { id: "passat-nms", name: "Passat NMS", photo: "passat-nms.jpg", body: "sedan", keys: ["passat nms"] },
    { id: "passat", name: "Passat R-Line", photo: "passat.jpg", body: "sedan", keys: ["passat", "passat b8", "passat tsi"] },
    { id: "cc", name: "Volkswagen CC", photo: "cc.jpg", body: "sedan", keys: ["vw cc", "volkswagen cc", "cc"] },
    { id: "arteon-shooting-brake", name: "Arteon Shooting Brake", photo: "arteon-shooting-brake.jpg", body: "sedan", keys: ["arteon shooting brake", "shooting brake"] },
    { id: "arteon", name: "Arteon Fastback", photo: "arteon.jpg", body: "sedan", keys: ["arteon", "vw arteon"] },
    { id: "bora-variant", name: "Bora Variant", photo: "bora-variant.jpg", body: "sedan", keys: ["bora variant"] },
    { id: "bora", name: "Bora 2.0", photo: "bora.jpg", body: "sedan", keys: ["bora"] },
    { id: "phaeton", name: "Phaeton W12", photo: "phaeton.jpg", body: "sedan", keys: ["phaeton"] },
    { id: "polo-seda", name: "Polo Sedã / Virtus", photo: "polo-seda.jpg", body: "sedan", keys: ["polo seda", "polo sedã", "polo sedan", "virtus", "polo classic"] },
    { id: "polo-hatch", name: "Polo Hatch TSI", photo: "polo-hatch.jpg", body: "hatch", keys: ["polo", "polo track", "polo tsi", "polo msi", "polo gts", "novo polo", "gol", "fox"] },
    { id: "eos", name: "Eos Cabriolet", photo: "eos.jpg", body: "sedan", keys: ["eos"] },
    { id: "up", name: "Up! / Up TSI", photo: "up.jpg", body: "hatch", keys: ["up", "up!", "up tsi", "move up", "take up", "high up", "cross up"] },
    { id: "e-up", name: "e-Up! Elétrico", photo: "e-up.jpg", body: "hatch", keys: ["e-up", "eup", "up eletrico"] },
    { id: "beetle-cabriolet", name: "Beetle Cabriolet", photo: "beetle-cabriolet.jpg", body: "hatch", keys: ["beetle cabriolet", "fusca conversivel"] },
    { id: "beetle", name: "Beetle (Fusca TSI)", photo: "beetle.jpg", body: "hatch", keys: ["beetle", "fusca", "fusca tsi", "novo fusca", "new beetle"] },
    { id: "scirocco", name: "Scirocco Coupé", photo: "scirocco.jpg", body: "hatch", keys: ["scirocco"] },
    { id: "lupo-3l", name: "Lupo 3L TDI", photo: "lupo-3l.jpg", body: "hatch", keys: ["lupo 3l"] },
    { id: "lupo", name: "Lupo Compacto", photo: "lupo.jpg", body: "hatch", keys: ["lupo"] },
    { id: "id-3", name: "ID.3 100% Elétrico", photo: "id-3.jpg", body: "hatch", keys: ["id.3", "id3", "id 3"] },
    { id: "id-4", name: "ID.4 SUV Elétrico", photo: "id-4.jpg", body: "suv", keys: ["id.4", "id4", "id 4"] },
    { id: "tiguan-5n-referencia-para-limited", name: "Tiguan 5N Limited", photo: "tiguan-5n-referencia-para-limited.jpg", body: "suv", keys: ["tiguan 5n", "tiguan limited"] },
    { id: "tiguan", name: "Tiguan 350 TSI", photo: "tiguan.jpg", body: "suv", keys: ["tiguan", "tiguan allspace", "tiguan r-line", "taos", "t-cross", "nivus"] },
    { id: "touareg", name: "Touareg V6 R-Line", photo: "touareg.jpg", body: "suv", keys: ["touareg", "touareg v6", "touareg v8"] },
    { id: "atlas", name: "Atlas 7 Lugares", photo: "atlas.jpg", body: "suv", keys: ["atlas", "teramont"] },
    { id: "e-crafter", name: "e-Crafter Elétrico", photo: "e-crafter.jpg", body: "van", keys: ["e-crafter", "ecrafter"] },
    { id: "crafter", name: "Crafter Furgão", photo: "crafter.jpg", body: "van", keys: ["crafter"] },
    { id: "transporter", name: "Transporter T6 / Kombi", photo: "transporter.jpg", body: "van", keys: ["transporter", "t6", "kombi", "caravelle", "multivan"] },
    { id: "caddy", name: "Caddy Furgão", photo: "caddy.jpg", body: "van", keys: ["caddy"] },
    { id: "touran", name: "Touran Minivan", photo: "touran.jpg", body: "van", keys: ["touran"] },
    { id: "sharan", name: "Sharan 7 Lugares", photo: "sharan.jpg", body: "van", keys: ["sharan"] },
    { id: "tge-man", name: "MAN TGE Comercial", photo: "tge-man.jpg", body: "van", keys: ["tge", "man tge"] }
  ];

  function clean(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").trim();
  }

  window.GTechVwMatcher = {
    models: VW_MODELS,

    recognize: function(brand, model) {
      const b = clean(brand);
      const m = clean(model);
      const comb = (b + " " + m).trim();

      const isVw = b.includes("volks") || b.includes("vw") || m.includes("volks") || m.includes("vw") ||
        VW_MODELS.some(item => item.keys.some(k => m.includes(k) || comb.includes(k))) ||
        m.includes("amarok") || m.includes("saveiro") || m.includes("voyage") || m.includes("virtus");

      if (!isVw) {
        return { isVw: false };
      }

      // Check specific models
      for (const item of VW_MODELS) {
        for (const k of item.keys) {
          if (m.includes(k) || comb.includes(k)) {
            return {
              isVw: true,
              id: item.id,
              name: item.name,
              body: item.body,
              photoUrl: "img/vehicles/volkswagen/fotos/" + item.photo,
              confidence: "high"
            };
          }
        }
      }

      // Special Picape fallback (Amarok / Saveiro)
      if (m.includes("amarok") || m.includes("saveiro")) {
        return {
          isVw: true,
          id: "amarok",
          name: "Volkswagen " + (model || "Picape"),
          body: "picape",
          photoUrl: "img/vehicles/picape-real.jpg",
          confidence: "high"
        };
      }

      // General default Volkswagen
      return {
        isVw: true,
        id: "golf-vii",
        name: "Volkswagen " + (model || "Golf VII TSI"),
        body: "hatch",
        photoUrl: "img/vehicles/volkswagen/fotos/golf-vii.jpg",
        confidence: "fallback"
      };
    }
  };
})();

