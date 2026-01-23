'use client';

import { useState } from 'react';

import Script from 'next/script';

interface ApiResult {
  success: boolean;
  message?: string;
  candidates?: string[];
  view_url?: string;
  image_id?: string;
  audio_id?: string;
  [key: string]: unknown;
}

declare const puter: any;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'image' | 'audio'>('image');
  
  // Audio State
  const [audioMode, setAudioMode] = useState<'tts' | 's2s'>('tts');
  const [audioProvider, setAudioProvider] = useState<'elevenlabs' | 'cartesia'>('elevenlabs');
  const [audioText, setAudioText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioResult, setAudioResult] = useState<{ view_url: string } | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  // Image State
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>('nano-banana-pro');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Auth State
  const [user, setUser] = useState<{ username: string, email: string } | null>(null);
  const [showAuth, setShowAuth] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ fullName: '', username: '', email: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Selection & Saving state
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<{ view_url: string } | null>(null);

  // New states
  const [inputImages, setInputImages] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Gallery State
  const [myImages, setMyImages] = useState<any[]>([]);
  const [myAudios, setMyAudios] = useState<any[]>([]);
  const [showGallery, setShowGallery] = useState<boolean>(false);
  const [galleryLoading, setGalleryLoading] = useState<boolean>(false);

  const [progress, setProgress] = useState<number>(0);

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length + inputImages.length > 3) {
      alert("Máximo 3 imágenes permitidas");
      return;
    }
    setInputImages(prev => [...prev, ...validFiles].slice(0, 3));
  };

  const fetchMyImages = async () => {
    setGalleryLoading(true);
    try {
      const res = await fetch('/api/my-images');
      const data = await res.json();
      if (data.success) {
        setMyImages(data.images);
      }
    } catch (e) {
      console.error("Error fetching images", e);
    } finally {
      setGalleryLoading(false);
    }
  };

  const fetchMyAudios = async () => {
    setGalleryLoading(true);
    try {
      const res = await fetch('/api/my-audios');
      const data = await res.json();
      if (data.success) {
        setMyAudios(data.audios);
      }
    } catch (e) {
        console.error("Error fetching audios", e);
    } finally {
        setGalleryLoading(false);
    }
  };

  const toggleGallery = () => {
    if (!showGallery) {
      if (activeTab === 'image') fetchMyImages();
      else fetchMyAudios();
    }
    setShowGallery(!showGallery);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    const payload = authMode === 'signup' 
        ? authForm 
        : { identifier: authForm.email || authForm.username, password: authForm.password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Auth failed');
        
        setUser(data.user);
        setShowAuth(false);
        setAuthForm({ fullName: '', username: '', email: '', password: '' }); // Clear sensitive data
    } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
        setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      setShowAuth(true);
      setResult(null);
  };

  const removeImage = (index: number) => {
    setInputImages(prev => prev.filter((_, i) => i !== index));
  };

  const toBase64 = (file: File): Promise<string> => 
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 5;
      });
    }, 500);
    return interval;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedCandidate(null);
    setSaveResult(null);
    
    const progressInterval = simulateProgress();

    try {
      // Convert images to base64
      const filesBase64 = await Promise.all(inputImages.map(img => toBase64(img)));
      const cleanBase64 = filesBase64.map(s => {
        const parts = s.split(',');
        return parts.length > 1 ? parts[1] : s;
      });

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt, 
          model,
          input_images: cleanBase64 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error generating image');
      }

      setProgress(100);
      setResult(data);
    } catch (err: unknown) {
        let msg = "Unknown error";
        if (err instanceof Error) msg = err.message;
        setError(msg);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      if (!error) setProgress(100);
      else setProgress(0); 
    }
  };


  const handleAudioGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        setError("Debes iniciar sesión");
        return;
    }
    setAudioLoading(true);
    setAudioResult(null);
    setError(null);

    try {
        if (audioMode === 'tts') {
            if (audioProvider === 'cartesia') {
                // Server-side Cartesia
                const res = await fetch('/api/tts/cartesia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: audioText })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Error generating audio');
                setAudioResult({ view_url: data.view_url });
            } else {
                // Client-side Puter (ElevenLabs)
                // @ts-ignore
                if (typeof puter === 'undefined') throw new Error("Puter.js not loaded");
                const audio = await puter.ai.txt2speech(audioText, {
                    provider: 'elevenlabs',
                    model: 'eleven_multilingual_v2',
                    voice: '21m00Tcm4TlvDq8ikWAM' // Rachel
                });
                
                // Audio is an HTMLAudioElement with src="blob:..."
                const blobUrl = audio.src;
                const blob = await fetch(blobUrl).then(r => r.blob());
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64data = reader.result as string;
                    // Upload to save
                    const saveRes = await fetch('/api/save-audio', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                             audioData: base64data,
                             prompt: audioText,
                             provider: 'elevenlabs-puter',
                             mimeType: blob.type
                        })
                    });
                    const saveData = await saveRes.json();
                    if(saveData.success) {
                        setAudioResult({ view_url: saveData.view_url });
                    }
                };
            }
        } else {
            // S2S (Voice Cloning/Conversion)
            if (!audioFile) throw new Error("Select an audio file");
            
            // We need a URL for Puter. 
            // Workaround: We upload to a temp endpoint or just use URL.createObjectURL?
            // Puter.js runs in browser, so URL.createObjectURL(file) MIGHT work if Puter library handles blob URLs?
            // If Puter sends URL to server, it fails. If Puter fetches natively, it works.
            // Documentation says "puter.ai.speech2speech(url)".
            // Let's try object URL.
            const objectUrl = URL.createObjectURL(audioFile);
            
            // @ts-ignore
            const audio = await puter.ai.speech2speech(objectUrl, {
                 provider: 'elevenlabs',
                 model: 'eleven_multilingual_sts_v2',
                 voice: '21m00Tcm4TlvDq8ikWAM' 
            });
            
             const blobUrl = audio.src;
             const blob = await fetch(blobUrl).then(r => r.blob());
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             reader.onloadend = async () => {
                 const base64data = reader.result as string;
                 const saveRes = await fetch('/api/save-audio', {
                     method: 'POST',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({
                          audioData: base64data,
                          prompt: "Voice Conversion",
                          provider: 'elevenlabs-puter-s2s',
                          mimeType: blob.type
                     })
                 });
                 const saveData = await saveRes.json();
                 if(saveData.success) {
                     setAudioResult({ view_url: saveData.view_url });
                 }
             };
        }
    } catch (e: any) {
        console.error(e);
        setError(e.message || "Error generating audio");
    } finally {
        setAudioLoading(false);
    }
  };

  const handleSaveImage = async () => {
      if (selectedCandidate === null || !result?.candidates) return;
      setSaving(true);
      
      try {
          const filesBase64 = await Promise.all(inputImages.map(img => toBase64(img)));

          const res = await fetch('/api/save-image', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  prompt,
                  model,
                  imageData: result.candidates[selectedCandidate],
                  input_images: filesBase64 // Send full input images to save context if needed
              })
          });
          
          const data = await res.json();
          if (data.success) {
              setSaveResult({ view_url: data.view_url });
              // Clear candidates to show only saved result? Or keep them? 
              // Keep them allows specific user flow, but requirements say "others are discarded".
              // Visual "Discard" by hiding candidates section could be nice.
          } else {
              alert("Error converting/saving: " + data.message);
          }
      } catch (e) {
          alert("Error saving image");
      } finally {
          setSaving(false);
      }
  };


  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h1 style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🧪 Getzumi AI Tester</span>
        {user && (
            <div style={{ fontSize: '14px', fontWeight: 'normal' }}>
                👤 {user.username} 
                <button onClick={toggleGallery} style={{ marginLeft: '10px', padding: '4px 8px', border: '1px solid #0070f3', borderRadius: '4px', background: showGallery ? '#0070f3' : 'transparent', color: showGallery ? 'white' : '#0070f3', cursor: 'pointer' }}>
                  {activeTab === 'image' ? '🖼️ Mis Imágenes' : '🎧 Mis Audios'}
                </button>
                <button onClick={handleLogout} style={{ marginLeft: '10px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>Salir</button>
            </div>
        )}
      </h1>

      {/* Gallery Section */}
      {showGallery && user && (
        <div style={{ marginBottom: '30px', padding: '20px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #cce5ff' }}>
          <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
            {activeTab === 'image' ? '🖼️ Mi Galería de Imágenes' : '🎧 Mi Biblioteca de Audio'}
            <button onClick={activeTab === 'image' ? fetchMyImages : fetchMyAudios} style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}>🔄 Actualizar</button>
          </h3>
          
          {galleryLoading ? (
            <p>Cargando...</p>
          ) : (activeTab === 'image' ? myImages.length === 0 : myAudios.length === 0) ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No tienes {activeTab === 'image' ? 'imágenes' : 'audios'} guardadas aún.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
              {activeTab === 'image' ? myImages.map((img) => (
                <div key={img.id} style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <a href={img.view_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.view_url} alt={img.prompt} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }} />
                  </a>
                  <p style={{ fontSize: '11px', margin: '5px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }} title={img.prompt}>
                    {img.prompt}
                  </p>
                  <p style={{ fontSize: '10px', color: '#888', margin: '2px 0 0' }}>
                    {new Date(img.created_at).toLocaleDateString()}
                  </p>
                </div>
              )) : myAudios.map((audio) => (
                <div key={audio.id} style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                   <div style={{ width: '100%', aspectRatio: '1/1', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', marginBottom: '5px' }}>
                       <span style={{ fontSize: '40px' }}>🎵</span>
                   </div>
                   {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                   <audio controls src={audio.view_url} style={{ width: '100%', height: '30px' }} />
                   <p style={{ fontSize: '11px', margin: '5px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }} title={audio.prompt}>
                    {audio.prompt}
                  </p>
                  <p style={{ fontSize: '10px', color: '#888', margin: '2px 0 0' }}>
                     {audio.provider} • {new Date(audio.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auth Section */}
      {(!user || showAuth) && (
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e9ecef' }}>
              <h3 style={{ marginTop: 0 }}>🔐 Autenticación Requerida</h3>
              <p style={{ fontSize: '14px', color: '#666' }}>Debes iniciar sesión para guardar tus generaciones.</p>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button onClick={() => setAuthMode('signin')} style={{ flex: 1, padding: '8px', borderBottom: authMode === 'signin' ? '2px solid #0070f3' : '1px solid #ddd', background: 'transparent', fontWeight: authMode === 'signin' ? 'bold' : 'normal' }}>Iniciar Sesión</button>
                  <button onClick={() => setAuthMode('signup')} style={{ flex: 1, padding: '8px', borderBottom: authMode === 'signup' ? '2px solid #0070f3' : '1px solid #ddd', background: 'transparent', fontWeight: authMode === 'signup' ? 'bold' : 'normal' }}>Registrarse</button>
              </div>

              <form onSubmit={handleAuth}>
                  {authMode === 'signup' && (
                      <div style={{ marginBottom: '10px' }}>
                          <input 
                            placeholder="Nombre Completo"
                            value={authForm.fullName}
                            onChange={e => setAuthForm({...authForm, fullName: e.target.value})}
                            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                          />
                      </div>
                  )}
                  
                  {authMode === 'signup' && (
                      <div style={{ marginBottom: '10px' }}>
                          <input 
                            type="email"
                            placeholder="Email"
                            value={authForm.email}
                            onChange={e => setAuthForm({...authForm, email: e.target.value})} 
                            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                          />
                      </div>
                  )}

                  <div style={{ marginBottom: '10px' }}>
                     {authMode === 'signin' ? (
                         <input 
                            placeholder="Usuario o Email"
                            value={authForm.username} 
                            onChange={e => setAuthForm({...authForm, username: e.target.value, email: e.target.value})} 
                            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                          />
                     ) : (
                         <input 
                            placeholder="Nombre de Usuario"
                            value={authForm.username} 
                            onChange={e => setAuthForm({...authForm, username: e.target.value})} 
                            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                          />
                     )}
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                      <input 
                        type="password"
                        placeholder="Contraseña"
                        value={authForm.password}
                        onChange={e => setAuthForm({...authForm, password: e.target.value})}
                        style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                        required
                      />
                  </div>

                  {authError && <p style={{ color: 'red', fontSize: '13px' }}>{authError}</p>}

                  <button 
                    type="submit" 
                    disabled={authLoading}
                    style={{ width: '100%', padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                      {authLoading ? 'Procesando...' : (authMode === 'signin' ? 'Entrar' : 'Registrarme')}
                  </button>
              </form>
          </div>
      )}
      
      <Script src="https://js.puter.com/v2/" />

      {/* Mode Switcher */}
      {user && (
          <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
              <button 
                onClick={() => setActiveTab('image')}
                style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'image' ? '2px solid #0070f3' : 'none', fontWeight: activeTab === 'image' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                  🖼️ Imágenes
              </button>
              <button 
                onClick={() => setActiveTab('audio')}
                style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'audio' ? '2px solid #0070f3' : 'none', fontWeight: activeTab === 'audio' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                  🔊 Audio / Voz
              </button>
          </div>
      )}

      {activeTab === 'image' && (
      <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', marginBottom: '20px', opacity: !user ? 0.5 : 1, pointerEvents: !user ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
          <span style={{ background: '#0070f3', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginRight: '10px' }}>POST</span>
          <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>/api/generate</code>
        </div>
        
        <p style={{ color: '#666', marginBottom: '15px', fontSize: '14px' }}>
          Genera una imagen basada en un prompt de texto utilizando el modelo Gemini seleccionado. Puedes incluir hasta 3 imágenes de referencia (opcional).
        </p>

        <form onSubmit={handleGenerate}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Prompt:</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: A futuristic cat wearing sunglasses..."
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px', fontFamily: 'inherit' }}
              required
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
             <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Imágenes de Referencia ({inputImages.length}/3 - Opcional):</label>
             <div 
               onDragEnter={handleDrag} 
               onDragLeave={handleDrag} 
               onDragOver={handleDrag} 
               onDrop={handleDrop}
               style={{ 
                 border: `2px dashed ${dragActive ? '#0070f3' : '#ccc'}`,
                 borderRadius: '6px',
                 padding: '20px',
                 textAlign: 'center',
                 background: dragActive ? '#f0f8ff' : '#fafafa',
                 transition: 'all 0.2s',
                 cursor: 'pointer'
               }}
             >
               <input 
                 type="file" 
                 id="file-upload" 
                 multiple 
                 accept="image/*" 
                 onChange={handleChange} 
                 style={{ display: 'none' }} 
               />
               <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                 <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>
                   Arrastra tus imágenes aquí o haz clic para seleccionar
                 </p>
                 <span style={{ fontSize: '12px', color: '#888' }}>(Máx. 3 imágenes)</span>
               </label>

               {/* Preview Area */}
               {inputImages.length > 0 && (
                 <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                   {inputImages.map((file, idx) => (
                     <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                       <img 
                         src={URL.createObjectURL(file)} 
                         alt="preview" 
                         style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} 
                       />
                       <button
                         type="button"
                         onClick={(e) => { e.preventDefault(); removeImage(idx); }}
                         style={{
                           position: 'absolute', top: -5, right: -5, background: 'red', color: 'white',
                           border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                         }}
                       >
                         x
                       </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Model:</label>
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', background: 'white' }}
            >
              <option value="nano-banana-pro">Nano Banana Pro</option>
              <option value="sora_image">Sora Image</option>
              <option value="seedream-4-5-251128">SeeDream 4.5</option>
            </select>
          </div>

          {/* Progress Bar */}
          {loading && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ width: '100%', background: '#eee', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${progress}%`, 
                  background: '#0070f3', 
                  height: '100%', 
                  transition: 'width 0.5s ease-in-out' 
                }} />
              </div>
              <p style={{ textAlign: 'center', fontSize: '12px', margin: '5px 0 0', color: '#666' }}>
                Generando... {progress}%
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: loading ? '#ccc' : '#0070f3', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: '5px', 
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              width: '100%'
            }}
          >
            {loading ? 'Procesando...' : '🚀 Generar Imagen'}
          </button>
        </form>
      </div>
      )}

      {error && activeTab === 'image' && (
        <div style={{ background: '#fff2f2', border: '1px solid #ffcccc', color: '#cc0000', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && activeTab === 'image' && (
        <div style={{ background: '#f9fff9', border: '1px solid #ccffcc', padding: '20px', borderRadius: '6px' }}>
          <h3 style={{ marginTop: 0, color: '#006600' }}>✅ Resultados ({result.candidates?.length} generadas):</h3>          
          
          {/* Candidates Grid */}
          {result.candidates && !saveResult && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '15px' }}>
                  {result.candidates.map((imgSrc, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setSelectedCandidate(idx)}
                        style={{ 
                            border: selectedCandidate === idx ? '4px solid #0070f3' : '2px solid transparent',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: selectedCandidate === idx ? '0 0 10px rgba(0,112,243,0.5)' : 'none'
                        }}
                      >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgSrc} alt={`Candidate ${idx+1}`} style={{ width: '100%', display: 'block' }} />
                          {selectedCandidate === idx && (
                              <div style={{ position: 'absolute', top: 5, right: 5, background: '#0070f3', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✓</div>
                          )}
                      </div>
                  ))}
              </div>
          )}

          {/* Action Area */}
          {!saveResult && result.candidates && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#555', fontSize: '14px', fontStyle: 'italic', marginBottom: '10px' }}>
                      Selecciona tu imagen favorita y guárdala. Las demás serán descartadas.
                  </p>
                  <button 
                    onClick={handleSaveImage}
                    disabled={selectedCandidate === null || saving}
                    style={{ 
                        background: selectedCandidate === null ? '#ccc' : '#28a745',
                        color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px',
                        fontSize: '16px', fontWeight: 'bold', cursor: selectedCandidate === null ? 'not-allowed' : 'pointer'
                    }}
                  >
                      {saving ? 'Guardando...' : '💾 Guardar Imagen Seleccionada'}
                  </button>
              </div>
          )}

          {/* Final Result View */}
          {saveResult && saveResult.view_url && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <div style={{ background: '#e6ffe6', padding: '15px', borderRadius: '8px', border: '1px solid #b3ffb3', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#006600' }}>¡Imagen Guardada con Éxito!</h4>
                  <p style={{ margin: 0 }}>Las demás opciones han sido descartadas.</p>
              </div>
              <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Vista Previa Final:</p>
              <a href={saveResult.view_url} target="_blank" rel="noopener noreferrer">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img 
                  src={result.candidates![selectedCandidate!]} // Show local base64 or fetch from new URL if desired, simplified here
                  alt="Generada Final" 
                  style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} 
                />
              </a>
              <p style={{ marginTop: '10px' }}>
                  <a href={saveResult.view_url} target="_blank" style={{ color: '#0070f3' }}>Abrir URL Permanente</a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Audio Tab */}
      {activeTab === 'audio' && (
      <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', marginBottom: '20px', opacity: !user ? 0.5 : 1, pointerEvents: !user ? 'none' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ background: '#0070f3', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginRight: '10px' }}>POST</span>
            <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>/api/tts/generate</code>
          </div>
          
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
               <button type="button" onClick={()=>setAudioMode('tts')} style={{ padding:'5px 10px', background: audioMode==='tts'?'#333':'#eee', color: audioMode==='tts'?'white':'black', border:'none', borderRadius:'4px', cursor: 'pointer' }}>Text to Speech</button>
               <button type="button" onClick={()=>setAudioMode('s2s')} style={{ padding:'5px 10px', background: audioMode==='s2s'?'#333':'#eee', color: audioMode==='s2s'?'white':'black', border:'none', borderRadius:'4px', cursor: 'pointer' }}>Voice Clone (S2S)</button>
          </div>

          <form onSubmit={handleAudioGenerate}>
              {audioMode === 'tts' && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Proveedor:</label>
                        <select value={audioProvider} onChange={(e)=>setAudioProvider(e.target.value as any)} style={{ width: '100%', padding: '10px', borderRadius: '4px', background: 'white', border: '1px solid #ccc' }}>
                            <option value="elevenlabs">ElevenLabs</option>
                            <option value="cartesia">Cartesia</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Texto:</label>
                        <textarea 
                            value={audioText}
                            onChange={(e) => setAudioText(e.target.value)}
                            placeholder="Escribe algo para hablar..."
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px', fontFamily: 'inherit' }}
                            required={audioMode === 'tts'}
                        />
                    </div>
                  </>
              )}

              {audioMode === 's2s' && (
                   <div style={{ marginBottom: '15px' }}>
                       <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                           Sube un audio para convertirlo a la voz de &quot;Rachel&quot; usando ElevenLabs (Puter).
                       </p>
                       <input 
                         type="file" 
                         accept="audio/*"
                         onChange={(e) => e.target.files && setAudioFile(e.target.files[0])}
                         required={audioMode === 's2s'}
                       />
                   </div>
              )}

              <button 
                type="submit" 
                disabled={audioLoading}
                style={{ 
                  background: audioLoading ? '#ccc' : '#0070f3', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '5px', 
                  cursor: audioLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  width: '100%'
                }}
              >
                {audioLoading ? 'Generando...' : '🎧 Generar Audio'}
              </button>
          </form>
          
          {error && activeTab === 'audio' && (
            <div style={{ marginTop: '20px', background: '#fff2f2', border: '1px solid #ffcccc', color: '#cc0000', padding: '15px', borderRadius: '6px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {audioResult && (
             <div style={{ marginTop: '20px', background: '#f9fff9', border: '1px solid #ccffcc', padding: '20px', borderRadius: '6px', textAlign: 'center' }}>
                 <h3 style={{ marginTop: 0, color: '#006600' }}>✅ Audio Generado</h3>
                 {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                 <audio controls src={audioResult.view_url} style={{ width: '100%', marginBottom: '10px' }} autoPlay />
                 <p><a href={audioResult.view_url} target="_blank" style={{ color: '#0070f3' }}>Abrir Enlace Permanente</a></p>
             </div>
          )}

      </div>
      )}

  </main>
  )}