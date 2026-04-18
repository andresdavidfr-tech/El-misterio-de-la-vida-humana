import { GoogleGenAI, Modality } from "@google/genai";
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY not found in environment");
  process.exit(1);
}

const ai = new GoogleGenAI(API_KEY);

const KEYS = [
  "Imagina un guante, hecho con cuidado a la imagen de una mano. ¿Su propósito? No es solo existir, sino contener la mano que le da vida y movimiento. Así es la humanidad: fuimos creados a imagen de Dios para contenerle a Él.",
  "Como una casa con tres habitaciones distintas: con el cuerpo contactamos la esfera física. Con el alma -nuestra mente- percibimos el mundo psicológico. Pero en lo más profundo reside el espíritu, diseñado exclusivamente para contactar y recibir a Dios mismo.",
  "Algo salió mal. El pecado entró y trajo oscuridad. Aquella 'habitación' del espíritu quedó en silencio, la mente se alejó de su Creador y el cuerpo se volvió frágil. El hombre quedó vacío en su interior, desconectado de su fuente de vida.",
  "Pero el Plan no se detuvo. Dios mismo se hizo humano en Jesús. Él pagó el precio en la cruz para borrar esa oscuridad. En Su resurrección, se hizo Espíritu vivificante, una vida lista para ser compartida con quien la desee.",
  "Este es el momento de la chispa. Puedes recibir esta vida ahora mismo. Es tan simple como abrir el corazón y hablarle a Él. Muchos lo hacen con estas palabras sinceras:",
  "La regeneración es solo el comienzo. Ahora, esa vida en tu espíritu empieza a extenderse, como una luz que ilumina cada rincón de tu mente y tus emociones. Este proceso de transformación culminará un día en la gloria total, donde todo nuestro ser estará saturado de Su vida incomparable."
];

function writeWavHeader(sampleRate, numChannels, byteLength) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * 2, 28);
  header.writeUInt16LE(numChannels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(byteLength, 40);
  return header;
}

async function generate() {
  const outputDir = path.join(process.cwd(), 'public', 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < KEYS.length; i++) {
    console.log(`Generating audio for stage ${i + 1}...`);
    try {
      const response = await ai.getGenerativeModel({ model: "gemini-3.1-flash-tts-preview" }).generateContent({
        contents: [{ parts: [{ text: `Actúa como un narrador cálido y lee esto: ${KEYS[i]}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioPart = response.response.candidates[0].content.parts.find(p => p.inlineData);
      if (audioPart?.inlineData?.data) {
        const base64Data = audioPart.inlineData.data;
        const binaryData = Buffer.from(base64Data, 'base64');
        const wavHeader = writeWavHeader(24000, 1, binaryData.length);
        const fullAudio = Buffer.concat([wavHeader, binaryData]);
        
        fs.writeFileSync(path.join(outputDir, `step_${i + 1}.wav`), fullAudio);
        console.log(`Saved step_${i + 1}.wav`);
      }
    } catch (e) {
      console.error(`Failed stage ${i + 1}:`, e);
    }
  }
  console.log("Generation complete.");
}

generate();
