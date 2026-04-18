/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Heart, Ghost, Cross, Sparkles, BookOpen, User, Volume2, VolumeX, Play } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

interface KeyData {
  id: number;
  title: string;
  content: string;
  narrative: string;
  icon: any;
  extra?: string;
}

const KEYS: KeyData[] = [
  {
    id: 1,
    title: "El plan de Dios",
    icon: User,
    content: "Dios desea expresarse a Sí mismo por medio del hombre. Él creó al hombre a Su propia imagen.",
    narrative: "Imagina un guante, hecho con cuidado a la imagen de una mano. ¿Su propósito? No es solo existir, sino contener la mano que le da vida y movimiento. Así es la humanidad: fuimos creados a imagen de Dios para contenerle a Él."
  },
  {
    id: 2,
    title: "El hombre",
    icon: Ghost,
    content: "El hombre es un vaso que consta de tres partes: cuerpo, alma y espíritu.",
    narrative: "Como una casa con tres habitaciones distintas: con el cuerpo contactamos la esfera física. Con el alma -nuestra mente- percibimos el mundo psicológico. Pero en lo más profundo reside el espíritu, diseñado exclusivamente para contactar y recibir a Dios mismo."
  },
  {
    id: 3,
    title: "La caída del hombre",
    icon: Heart,
    content: "El pecado entró en el hombre. El pecado puso al espíritu en una condición de muerte y arruinó al hombre.",
    narrative: "Algo salió mal. El pecado entró y trajo oscuridad. Aquella 'habitación' del espíritu quedó en silencio, la mente se alejó de su Creador y el cuerpo se volvió frágil. El hombre quedó vacío en su interior, desconectado de su fuente de vida."
  },
  {
    id: 4,
    title: "Cristo redime al hombre",
    icon: Cross,
    content: "Dios se hizo hombre, llamado Jesucristo. Cristo murió en la cruz para redimirnos y darnos vida.",
    narrative: "Pero el Plan no se detuvo. Dios mismo se hizo humano en Jesús. Él pagó el precio en la cruz para borrar esa oscuridad. En Su resurrección, se hizo Espíritu vivificante, una vida lista para ser compartida con quien la desee."
  },
  {
    id: 5,
    title: "La regeneración",
    icon: Sparkles,
    content: "El hombre ahora puede recibir la vida de Dios en su espíritu. Esto es nacer de nuevo.",
    narrative: "Este es el momento de la chispa. Puedes recibir esta vida ahora mismo. Es tan simple como abrir el corazón y hablarle a Él. Muchos lo hacen con estas palabras sinceras:",
    extra: "Señor Jesús, soy un pecador. Te necesito. Gracias por haber muerto por mí. Señor Jesús, perdóname y límpiame de todos mis pecados. Creo que Tú resucitaste de los muertos, y te recibo ahora mismo como mi Salvador y mi vida. ¡Entra en mí! ¡Lléname de Tu vida! Señor Jesús, me entrego a Ti por causa de Tu propósito."
  },
  {
    id: 6,
    title: "La salvación completa",
    icon: BookOpen,
    content: "Dios empieza un proceso donde se extiende como vida desde el espíritu al alma.",
    narrative: "La regeneración es solo el comienzo. Ahora, esa vida en tu espíritu empieza a extenderse, como una luz que ilumina cada rincón de tu mente y tus emociones. Este proceso de transformación culminará un día en la gloria total, donde todo nuestro ser estará saturado de Su vida incomparable."
  }
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCache = useRef<Map<number, AudioBuffer>>(new Map());
  const prefetching = useRef<Set<number>>(new Set());
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  // Initialize AI instance
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string }), []);

  const initAudioContext = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch (e) {
      console.error("AudioContext initialization failed", e);
      return null;
    }
  };

  const generateBackgroundMusic = () => {
    // Using a very stable ambient track
    const ambientMusicUrl = "https://cdn.pixabay.com/audio/2022/02/07/audio_d0c6ff1bdd.mp3"; // "Atmospheric Relaxing"
    
    if (bgMusicRef.current) {
      bgMusicRef.current.src = ambientMusicUrl;
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.12; 
      bgMusicRef.current.muted = isMuted;
      
      const playPromise = bgMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn("Ambient music play blocked:", e);
          // Retry on next click happens naturally via handleStart or other UI interactions
        });
      }
    }
  };

  const fetchAudioBuffer = async (text: string, stepId: number): Promise<AudioBuffer | null> => {
    if (audioCache.current.has(stepId)) return audioCache.current.get(stepId)!;
    if (prefetching.current.has(stepId)) return null;

    prefetching.current.add(stepId);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Actúa como un narrador cálido y lee esto: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (audioPart?.inlineData?.data) {
        const base64Audio = audioPart.inlineData.data;
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const bufferLen = Math.floor(len / 2);
        const audioContent = new Int16Array(bytes.buffer, 0, bufferLen);
        
        // Reuse context or create one if needed (but it will be resumed later)
        const context = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = context.createBuffer(1, audioContent.length, 24000);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < audioContent.length; i++) {
          channelData[i] = audioContent[i] / 32768;
        }

        audioCache.current.set(stepId, audioBuffer);
        return audioBuffer;
      }
    } catch (e) {
      console.error(`Prefetch failed for step ${stepId}:`, e);
    } finally {
      prefetching.current.delete(stepId);
    }
    return null;
  };

  const stopAudio = () => {
    if (audioRef.current) {
      try { audioRef.current.stop(); } catch(e) {}
      audioRef.current = null;
    }
    setIsNarrating(false);
  };

  const playNarration = async (stepIndex: number) => {
    if (isMuted) return;
    setError(null);
    stopAudio();
    setIsNarrating(true);

    // Give a bit of room for the transition
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const context = await initAudioContext();
      if (!context) throw new Error("Could not initialize audio context");

      let buffer = audioCache.current.get(stepIndex);
      if (!buffer) {
        buffer = await fetchAudioBuffer(KEYS[stepIndex].narrative, stepIndex) || undefined;
      }

      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => setIsNarrating(false);
        source.start();
        audioRef.current = source;
      } else {
        setIsNarrating(false);
      }
      
      // Prefetch next step
      if (stepIndex < KEYS.length - 1) {
        fetchAudioBuffer(KEYS[stepIndex + 1].narrative, stepIndex + 1);
      }
    } catch (error) {
      console.error("Narration failed:", error);
      setError("La narración tuvo un problema técnico. Puedes continuar leyendo.");
      setIsNarrating(false);
    }
  };

  // Prefetch first step on mount
  useEffect(() => {
    const warmup = async () => {
      await fetchAudioBuffer(KEYS[0].narrative, 0);
    };
    warmup();
  }, [ai]);

  useEffect(() => {
    if (hasStarted && !isFinished) {
      playNarration(currentStep);
    }
    return () => stopAudio();
  }, [currentStep, hasStarted, isMuted, isFinished]);

  const handleStart = async () => {
    try {
      await initAudioContext();
    } catch(e) {}
    setHasStarted(true);
    generateBackgroundMusic();
  };

  useEffect(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (isFinished && bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current.currentTime = 0;
    }
  }, [isFinished]);

  const nextStep = () => {
    if (currentStep < KEYS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setIsFinished(true);
      stopAudio();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const currentKey = KEYS[currentStep];
  const Icon = currentKey.icon;

  return (
    <div className="min-h-screen bg-[#0a0502] text-[#e0d8d0] font-sans selection:bg-[#ff4e00] selection:text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#3a1510_0%,transparent_60%),radial-gradient(circle_at_10%_80%,#ff4e00_0%,transparent_50%)] opacity-30 blur-[80px]"
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
      </div>

      {/* Top Controls */}
      <div className="absolute top-8 right-8 flex gap-4 z-50">
        <button 
          onClick={() => setIsMuted(m => !m)}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-white/60 hover:text-white"
          title={isMuted ? "Activar audio" : "Silenciar"}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className={isNarrating ? "animate-pulse text-[#ff4e00]" : ""} />}
        </button>
      </div>

      <main className="z-10 w-full max-w-2xl relative">
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center text-center py-20 px-8 bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-3xl"
            >
              <h1 className="text-4xl md:text-6xl font-serif font-light mb-8 text-white leading-tight">
                El Misterio de la Vida Humana
              </h1>
              <p className="text-lg md:text-xl text-white/60 mb-12 max-w-md leading-relaxed">
                Descubre el propósito que Dios tiene para ti a través de estas seis llaves reveladoras.
              </p>
              <button
                onClick={handleStart}
                className="group flex items-center gap-4 px-10 py-5 bg-white text-black rounded-full font-medium hover:bg-[#ff4e00] hover:text-white transition-all shadow-xl hover:shadow-[#ff4e00]/20"
              >
                <Play size={24} fill="currentColor" />
                <span className="text-lg tracking-wide">Comenzar el Viaje</span>
              </button>
              {error && (
                <p className="mt-4 text-sm text-[#ff4e00]/80">
                  {error}
                </p>
              )}
            </motion.div>
          ) : isFinished ? (
            <motion.div
              key="finish"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center py-20 px-8 bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-3xl"
            >
              <div className="mb-6 p-4 bg-[#ff4e00]/10 rounded-full text-[#ff4e00]">
                <Heart size={48} fill="currentColor" />
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-light mb-8 text-white">
                Has completado el misterio
              </h1>
              <p className="text-lg text-white/60 mb-12 max-w-md leading-relaxed">
                Este es solo el comienzo de tu caminar. Que la vida de Dios continúe transformando cada parte de tu ser.
              </p>
              <button
                onClick={() => {
                  setCurrentStep(0);
                  setIsFinished(false);
                  setHasStarted(false);
                }}
                className="px-8 py-4 border border-white/10 hover:bg-white/5 rounded-full transition-all text-sm uppercase tracking-widest"
              >
                Reiniciar Experiencia
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-8"
            >
              {/* Header Stage */}
              <div className="flex items-center gap-4">
                <div className="h-[1px] flex-grow bg-white/20" />
                <span className="font-mono text-xs tracking-widest text-[#ff4e00] uppercase">
                  Etapa {currentKey.id} de 6
                </span>
                <div className="h-[1px] flex-grow bg-white/20" />
              </div>

              {/* Content Card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 text-[#ff4e00]/20 group-hover:text-[#ff4e00]/40 transition-colors">
                  <Icon size={120} strokeWidth={1} />
                </div>

                <h2 className="text-3xl md:text-5xl font-serif font-light mb-6 text-white leading-tight">
                  {currentKey.title}
                </h2>

                <div className="flex gap-4 items-start mb-8">
                  {isNarrating && (
                    <div className="flex gap-1 h-4 items-center mt-3 mr-2">
                      <div className="w-1 bg-[#ff4e00] animate-sound-1 h-3 rounded-full" />
                      <div className="w-1 bg-[#ff4e00] animate-sound-2 h-4 rounded-full" />
                      <div className="w-1 bg-[#ff4e00] animate-sound-3 h-2 rounded-full" />
                    </div>
                  )}
                  <p className="text-lg md:text-xl text-white/80 leading-relaxed italic border-l-2 border-[#ff4e00] pl-6 py-2">
                    {currentKey.narrative}
                  </p>
                </div>

                <p className="text-base md:text-lg text-[#e0d8d0]/90 leading-relaxed font-light">
                  {currentKey.content}
                </p>

                {currentKey.extra && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 p-6 bg-black/40 rounded-2xl border border-white/5 font-serif italic text-white/70 text-sm leading-loose"
                  >
                    &ldquo;{currentKey.extra}&rdquo;
                  </motion.div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-[#ff4e00]/10 border border-[#ff4e00]/20 rounded-xl text-xs text-[#ff4e00] text-center">
                    {error}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 ${
                    currentStep === 0 
                      ? 'opacity-0 pointer-events-none' 
                      : 'hover:bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <ChevronLeft size={20} />
                  <span className="text-sm font-medium">Anterior</span>
                </button>

                <div className="flex gap-2">
                  {KEYS.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        idx === currentStep ? 'w-8 bg-[#ff4e00]' : 'w-2 bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextStep}
                  disabled={currentStep === KEYS.length - 1}
                  className={`flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-medium transition-all duration-300 transform active:scale-95 ${
                    currentStep === KEYS.length - 1 
                      ? 'opacity-30 cursor-not-allowed grayscale' 
                      : 'hover:bg-[#ff4e00] hover:text-white shadow-lg'
                  }`}
                >
                  <span className="text-sm">
                    {currentStep === KEYS.length - 1 ? 'Fin del viaje' : 'Continuar'}
                  </span>
                  {currentStep < KEYS.length - 1 && <ChevronRight size={20} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="absolute bottom-8 text-center">
        <p className="text-xs text-white/20 uppercase tracking-[0.2em] font-mono">
          Descubriendo el propósito de la existencia
        </p>
      </footer>

      <audio ref={bgMusicRef} style={{ display: 'none' }} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sound-1 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
        @keyframes sound-2 { 0%, 100% { height: 16px; } 50% { height: 10px; } }
        @keyframes sound-3 { 0%, 100% { height: 10px; } 50% { height: 16px; } }
        .animate-sound-1 { animation: sound-1 0.7s infinite ease-in-out; }
        .animate-sound-2 { animation: sound-2 0.9s infinite ease-in-out; }
        .animate-sound-3 { animation: sound-3 0.6s infinite ease-in-out; }
      `}} />
    </div>
  );
}
