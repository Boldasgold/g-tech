const fs = require('fs');

async function testGemmaVision() {
  const imgPath = 'C:/Users/tiujo/Desktop/g-tech/public/img/vehicles/volkswagen/fotos/jetta-gli.jpg';
  const imgBuffer = fs.readFileSync(imgPath);
  const base64 = imgBuffer.toString('base64');

  const prompt = `Você é o analisador visual assistivo da G-TECH Serviços Automotivos em Paranaguá-PR.
Analise esta foto do veículo e responda ESTRITAMENTE em formato JSON com as chaves:
{
  "visible_features": "descrição curta das características visuais externas",
  "suggested_brand": "Marca sugerida ou 'Não identificada'",
  "suggested_model": "Modelo sugerido ou 'A confirmar'",
  "body_type": "hatch" ou "sedan" ou "suv" ou "picape" ou "van",
  "color": "Cor predominante visível",
  "doubts": "Aspectos que exigem confirmação pelo documento/chassi"
}`;

  console.log('Enviando foto jetta-gli.jpg para Ollama gemma3:4b (tamanho base64:', base64.length, ')...');
  const t0 = Date.now();
  
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: prompt,
        images: [base64],
        stream: false,
        format: 'json'
      })
    });

    const data = await res.json();
    console.log('Tempo decorrido:', ((Date.now() - t0) / 1000).toFixed(2), 's');
    console.log('Resposta do modelo gemma3:4b:');
    console.log(data.response);
  } catch (err) {
    console.error('Erro ao chamar Ollama:', err.message);
  }
}

testGemmaVision();
