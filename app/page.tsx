'use client';

import { useState } from 'react';

interface ApiResult {
  success: boolean;
  message?: string;
  view_url?: string;
  image_id?: string;
  [key: string]: unknown;
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>('nano-banana-pro');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New states
  const [inputImages, setInputImages] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
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
    
    const progressInterval = simulateProgress();

    try {
      // Convert images to base64
      const filesBase64 = await Promise.all(inputImages.map(img => toBase64(img)));
      // Remove data URL prefix logic moved here to ensure we handle the string manipulation correctly
      // We stripping the header because backend route.ts takes raw base64 and maps to Binary directly
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
      // Wait a bit before resetting progress if successful, or leave it at 100
      if (!error) setProgress(100);
      else setProgress(0); 
    }
  };

  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h1 style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '10px', marginBottom: '20px' }}>
        🧪 Getzumi AI Endpoint Tester
      </h1>

      <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
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

      {error && (
        <div style={{ background: '#fff2f2', border: '1px solid #ffcccc', color: '#cc0000', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ background: '#f9fff9', border: '1px solid #ccffcc', padding: '20px', borderRadius: '6px' }}>
          <h3 style={{ marginTop: 0, color: '#006600' }}>✅ Resultado:</h3>          
          
          {result.view_url && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Vista Previa:</p>
              <a href={result.view_url} target="_blank" rel="noopener noreferrer">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img 
                  src={result.view_url} 
                  alt="Generada" 
                  style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} 
                />
              </a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
