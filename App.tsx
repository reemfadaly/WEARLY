import React, { useState, useRef } from 'react';
import { Section, WardrobeItem, UserProfile, ProcessingState, Category } from './types';
import { Icon } from './components/Icon';
import { LoadingOverlay } from './components/LoadingOverlay';
import { createProfileAvatar, categorizeItem, generateAvatarStyle, generateRealOutfit } from './services/geminiService';

const App: React.FC = () => {
  // --- STATE ---
  const [section, setSection] = useState<Section>(Section.HOME);
  const [userProfile, setUserProfile] = useState<UserProfile>({ avatarImage: null });
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  
  // Styling Studio State
  const [studioItems, setStudioItems] = useState<WardrobeItem[]>([]); // Items selected for the current styling session
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // UI State
  const [processing, setProcessing] = useState<ProcessingState>({ isLoading: false, statusMessage: '' });
  const [error, setError] = useState<string | null>(null);

  // Refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wardrobeInputRef = useRef<HTMLInputElement>(null);
  const studioInputRef = useRef<HTMLInputElement>(null);

  // --- HELPERS ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  // --- ACTIONS: PROFILE ---
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setProcessing({ isLoading: true, statusMessage: 'Generating your 3D avatar face...' });
      try {
        const base64 = await fileToBase64(file);
        const avatarResult = await createProfileAvatar({ base64, mimeType: file.type });
        setUserProfile({ avatarImage: avatarResult }); // Result is full Data URL
      } catch (err: any) {
        setError(err.message);
      } finally {
        setProcessing({ isLoading: false, statusMessage: '' });
      }
    }
  };

  // --- ACTIONS: WARDROBE ---
  const handleWardrobeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProcessing({ isLoading: true, statusMessage: 'Analyzing and categorizing items...' });
      const newFiles = Array.from(e.target.files) as File[];
      
      try {
        for (const file of newFiles) {
          const base64 = await fileToBase64(file);
          const { category, description } = await categorizeItem({ base64, mimeType: file.type });
          
          const newItem: WardrobeItem = {
            id: Date.now() + Math.random().toString(),
            image: `data:${file.type};base64,${base64}`, // Store as data URL for display
            category,
            description
          };
          setWardrobe(prev => [...prev, newItem]);
        }
      } catch (err: any) {
        setError("Failed to process some items: " + err.message);
      } finally {
        setProcessing({ isLoading: false, statusMessage: '' });
      }
    }
  };

  const deleteWardrobeItem = (id: string) => {
    setWardrobe(prev => prev.filter(item => item.id !== id));
  };

  // --- ACTIONS: STUDIO (Avatar & Real) ---
  const handleStudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      // Quickly add to studio items as 'uncategorized' temporarily just for the session
      const newItems = await Promise.all(newFiles.map(async (file) => ({
        id: Date.now() + Math.random().toString(),
        image: `data:${file.type};base64,${await fileToBase64(file)}`,
        category: 'Top' as Category, // Default
        description: 'Uploaded for styling'
      })));
      setStudioItems(prev => [...prev, ...newItems]);
    }
  };

  const toggleWardrobeItemInStudio = (item: WardrobeItem) => {
    setStudioItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const generateStyle = async () => {
    if (studioItems.length === 0) {
      setError("Please select or upload items first.");
      return;
    }
    setError(null);
    setGeneratedImage(null);

    // Prepare inputs robustly handling both raw base64 and data URIs
    const inputs = studioItems.map(item => {
      const parts = item.image.split(',');
      const base64 = parts.length > 1 ? parts[1] : item.image;
      const mimeMatch = item.image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      return { base64, mimeType };
    });

    try {
      if (section === Section.AVATAR_STUDIO) {
        setProcessing({ isLoading: true, statusMessage: 'Designing your 3D Outfit...' });
        const result = await generateAvatarStyle(inputs, userProfile.avatarImage || undefined);
        setGeneratedImage(result);
      } else {
        setProcessing({ isLoading: true, statusMessage: 'Arranging your 2D Outfit Grid...' });
        const result = await generateRealOutfit(inputs);
        setGeneratedImage(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing({ isLoading: false, statusMessage: '' });
    }
  };

  // --- VIEWS ---

  const renderHome = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-10">
      <div onClick={() => setSection(Section.PROFILE)} className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-brand-500 rounded-2xl cursor-pointer transition-all group">
        <div className="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
          <Icon name="user" className="w-6 h-6 text-purple-200" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">My Profile</h3>
        <p className="text-slate-400 text-sm">Create your persistent 3D facial avatar.</p>
      </div>
      
      <div onClick={() => setSection(Section.WARDROBE)} className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-brand-500 rounded-2xl cursor-pointer transition-all group">
        <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
          <Icon name="wardrobe" className="w-6 h-6 text-blue-200" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">My Wardrobe</h3>
        <p className="text-slate-400 text-sm">Upload, categorize, and save your garments.</p>
      </div>
      
      <div onClick={() => { setSection(Section.AVATAR_STUDIO); setStudioItems([]); setGeneratedImage(null); }} className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-brand-500 rounded-2xl cursor-pointer transition-all group">
        <div className="w-12 h-12 bg-pink-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-pink-600 transition-colors">
          <Icon name="sparkles" className="w-6 h-6 text-pink-200" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">Avatar Styling</h3>
        <p className="text-slate-400 text-sm">Try on clothes on your 3D avatar (with layering).</p>
      </div>

      <div onClick={() => { setSection(Section.REAL_STUDIO); setStudioItems([]); setGeneratedImage(null); }} className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-brand-500 rounded-2xl cursor-pointer transition-all group">
        <div className="w-12 h-12 bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
          <Icon name="camera" className="w-6 h-6 text-emerald-200" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">2D Studio</h3>
        <p className="text-slate-400 text-sm">Create realistic outfit lay-flat collages.</p>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="flex flex-col items-center max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Your Avatar Identity</h2>
      <div className="w-48 h-48 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center overflow-hidden mb-8 shadow-2xl relative">
        {userProfile.avatarImage ? (
          <img src={userProfile.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <Icon name="user" className="w-20 h-20 text-slate-600" />
        )}
        {processing.isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>}
      </div>
      
      <p className="text-center text-slate-400 mb-6">
        Upload a selfie to generate a stylized 3D face. This face will be used in the Avatar Studio to personalize your looks.
      </p>

      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleProfileUpload} />
      
      <button 
        onClick={() => avatarInputRef.current?.click()}
        disabled={processing.isLoading}
        className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="camera" className="w-5 h-5" />
        {userProfile.avatarImage ? 'Update Selfie' : 'Upload Selfie'}
      </button>
    </div>
  );

  const renderWardrobe = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Wardrobe ({wardrobe.length})</h2>
        <button 
          onClick={() => wardrobeInputRef.current?.click()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Icon name="plus" className="w-5 h-5" />
          Add Items
        </button>
        <input type="file" multiple ref={wardrobeInputRef} className="hidden" accept="image/*" onChange={handleWardrobeUpload} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto pb-20 custom-scrollbar">
        {wardrobe.map(item => (
          <div key={item.id} className="relative aspect-square bg-slate-800 rounded-xl p-2 border border-slate-700 group">
            <img src={item.image} alt={item.category} className="w-full h-full object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-center backdrop-blur-sm rounded-b-xl truncate">
              {item.category}
            </div>
            <button 
              onClick={() => deleteWardrobeItem(item.id)}
              className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="trash" className="w-4 h-4" />
            </button>
          </div>
        ))}
        {wardrobe.length === 0 && !processing.isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <Icon name="hanger" className="w-16 h-16 mb-4 opacity-30" />
            <p>Your wardrobe is empty. Upload some clothes!</p>
          </div>
        )}
      </div>
      {processing.isLoading && <LoadingOverlay message={processing.statusMessage} />}
    </div>
  );

  const renderStudio = (isAvatarMode: boolean) => (
    <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] gap-6">
      {/* Left: Controls & Selection */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex-1 flex flex-col min-h-0">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Icon name="hanger" className="w-5 h-5 text-brand-400" />
            Selected Items
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-2">
            {studioItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-lg border border-slate-600">
                <span className="text-xs font-mono text-slate-500 w-4">{index + 1}.</span>
                <img src={item.image} className="w-10 h-10 object-cover rounded bg-slate-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.category}</p>
                </div>
                <button onClick={() => setStudioItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-400 hover:text-red-400">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            ))}
            {studioItems.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No items selected.
                <br />Pick from wardrobe below or upload new.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
             <button 
              onClick={() => studioInputRef.current?.click()}
              className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              Upload New
            </button>
            <input type="file" multiple ref={studioInputRef} className="hidden" accept="image/*" onChange={handleStudioUpload} />
          </div>
        </div>

        {/* Wardrobe Quick Pick */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-48 flex flex-col">
          <h3 className="font-bold text-sm mb-2 text-slate-400">Quick Add from Wardrobe</h3>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
            {wardrobe.map(item => {
              const isSelected = studioItems.some(i => i.id === item.id);
              return (
                <div 
                  key={item.id} 
                  onClick={() => toggleWardrobeItemInStudio(item)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 cursor-pointer relative ${isSelected ? 'border-brand-500 opacity-50' : 'border-transparent bg-slate-700 hover:bg-slate-600'}`}
                >
                  <img src={item.image} className="w-full h-full object-contain p-1" />
                  {isSelected && <div className="absolute inset-0 flex items-center justify-center"><Icon name="x" className="w-6 h-6 text-brand-500" /></div>}
                </div>
              );
            })}
             {wardrobe.length === 0 && <span className="text-xs text-slate-600 m-auto">Wardrobe empty</span>}
          </div>
        </div>

        <button
          onClick={generateStyle}
          disabled={processing.isLoading || studioItems.length === 0}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
             processing.isLoading || studioItems.length === 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white'
          }`}
        >
          {processing.isLoading ? 'Processing...' : `Generate ${isAvatarMode ? 'Avatar' : 'Layout'}`}
        </button>
      </div>

      {/* Right: Output */}
      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden">
        {processing.isLoading && <LoadingOverlay message={processing.statusMessage} />}
        
        {generatedImage ? (
          <img src={generatedImage} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-center opacity-30">
            <Icon name={isAvatarMode ? "sparkles" : "camera"} className="w-24 h-24 mx-auto mb-4" />
            <p className="text-xl font-light">
              {isAvatarMode 
                ? "Ready to dress your avatar." 
                : "Ready to create your fashion layout."}
            </p>
          </div>
        )}
        
        {generatedImage && (
           <a 
              href={generatedImage} 
              download={`style-${Date.now()}.png`}
              className="absolute bottom-4 right-4 px-4 py-2 bg-slate-900/80 text-white rounded-lg backdrop-blur hover:bg-black transition-colors"
            >
              Download
           </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-brand-500 selection:text-white pb-20 md:pb-0">
      
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => { setSection(Section.HOME); setError(null); }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center">
              <Icon name="sparkles" className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-300 to-purple-400 hidden sm:block">
              StyleAvatar AI
            </h1>
          </div>
          
          <nav className="flex items-center gap-1">
             <button onClick={() => setSection(Section.HOME)} className={`p-2 rounded-lg ${section === Section.HOME ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:text-white'}`}>
               <Icon name="home" />
             </button>
             <button onClick={() => setSection(Section.WARDROBE)} className={`p-2 rounded-lg ${section === Section.WARDROBE ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:text-white'}`}>
               <Icon name="wardrobe" />
             </button>
             <div className="h-6 w-px bg-slate-700 mx-2"></div>
             {userProfile.avatarImage && (
                <div className="w-8 h-8 rounded-full border border-slate-600 overflow-hidden" title="Your Avatar">
                  <img src={userProfile.avatarImage} className="w-full h-full object-cover" />
                </div>
             )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-4 max-w-6xl mx-auto min-h-[calc(100vh-5rem)]">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center justify-between">
            <span className="text-red-200">{error}</span>
            <button onClick={() => setError(null)}><Icon name="x" className="w-5 h-5 text-red-200" /></button>
          </div>
        )}

        {section === Section.HOME && renderHome()}
        {section === Section.PROFILE && renderProfile()}
        {section === Section.WARDROBE && renderWardrobe()}
        {section === Section.AVATAR_STUDIO && renderStudio(true)}
        {section === Section.REAL_STUDIO && renderStudio(false)}
      </main>
    </div>
  );
};

export default App;