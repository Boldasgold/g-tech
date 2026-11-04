import fs from "node:fs";
import path from "node:path";

const VEHICLES_DIR = path.join(process.cwd(), "public", "img", "vehicles");
if (!fs.existsSync(VEHICLES_DIR)) {
  fs.mkdirSync(VEHICLES_DIR, { recursive: true });
}

const imagesToDownload = [
  {
    name: "suv-real.jpg",
    url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "hatch-real.jpg",
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "sedan-real.jpg",
    url: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "picape-real.jpg",
    url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "van-real.jpg",
    url: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "renault-duster.jpg",
    url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "renault-sandero.jpg",
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "renault-logan.jpg",
    url: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "renault-oroch.jpg",
    url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "renault-master.jpg",
    url: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "chevrolet-onix.jpg",
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "volkswagen-gol.jpg",
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80"
  }
];

async function run() {
  for (const item of imagesToDownload) {
    const filePath = path.join(VEHICLES_DIR, item.name);
    if (fs.existsSync(filePath)) {
      console.log(`Already exists: ${item.name}`);
      continue;
    }
    try {
      console.log(`Downloading: ${item.name}...`);
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      console.log(`✓ Saved ${item.name} (${arrayBuffer.byteLength} bytes)`);
    } catch (e) {
      console.error(`Failed ${item.name}: ${e.message}`);
    }
  }
}

run();
