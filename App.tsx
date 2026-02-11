import React, { useState, useRef, useEffect } from 'react';
import { Section, WardrobeItem, UserProfile, ProcessingState, Category, ShopItem } from './types';
import { Icon } from './components/Icon';
import { LoadingOverlay } from './components/LoadingOverlay';
import { createProfileAvatar, generateAvatarStyle, removeBackground } from './services/geminiService';

// --- MOCK DATA ---
const MOCK_PRODUCTS: ShopItem[] = [
  // Defacto
  { id: 'd1', brand: 'Defacto', name: 'Cotton T-Shirt', price: 700, category: 'Top', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=500' },
  { id: 'd2', brand: 'Defacto', name: 'Slim Jeans', price: 950, category: 'Bottom', image: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?auto=format&fit=crop&q=80&w=500' },
  { id: 'd3', brand: 'Defacto', name: 'Summer Dress', price: 1200, category: 'Dresses', image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=500' },
  // Azal
  { id: 'a1', brand: 'Azal', name: 'Linen Shirt', price: 850, category: 'Top', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=500' },
  { id: 'a2', brand: 'Azal', name: 'Cargo Pants', price: 1100, category: 'Bottom', image: 'https://images.unsplash.com/photo-1517445312882-5667b93c2352?auto=format&fit=crop&q=80&w=500' },
  { id: 'a3', brand: 'Azal', name: 'Silk Blouse', price: 1500, category: 'Top', image: 'https://images.unsplash.com/photo-1551163943-3f6a29e39426?auto=format&fit=crop&q=80&w=500' },
  // Extras to fill rows
  { id: 'x1', brand: 'Nike', name: 'Running Shoes', price: 3000, category: 'Shoes', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=500' },
  { id: 'x2', brand: 'Adidas', name: 'Sneakers', price: 2500, category: 'Shoes', image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=500' },
  { id: 'x3', brand: 'Gucci', name: 'Handbag', price: 5000, category: 'Bag', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=500' },
  { id: 'x4', brand: 'RayBan', name: 'Sunglasses', price: 1500, category: 'Accessory', image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=500' },
];

const CATEGORIES: { id: Category; label: string; image: string }[] = [
  { id: 'Top', label: 'Tops', image: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&q=80&w=500' },
  { id: 'Bottom', label: 'Bottoms', image: 'https://images.unsplash.com/photo-1475178626620-a4d074967452?auto=format&fit=crop&q=80&w=500' },
  { id: 'Dresses', label: 'Dresses', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=500' },
  { id: 'Bag', label: 'Bags', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=500' },
];

const App: React.FC = () => {
  // --- STATE ---
  const [section, setSection] = useState<Section>(Section.WARDROBE); // Default to Wardrobe for demo
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({ avatarImage: null });
  // Initialize wardrobe as empty so user can add their own items
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  
  // Styling Studio State
  const [studioItems, setStudioItems] = useState<WardrobeItem[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // UI State
  const [processing, setProcessing] = useState<ProcessingState>({ isLoading: false, statusMessage: '' });
  const [error, setError] = useState<string | null>(null);
  
  // Manual Categorization State
  const [pendingUploads, setPendingUploads] = useState<string[]>([]);

  // Selection Mode State (Wardrobe)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState<Set<string>>(new Set());

  // Refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wardrobeInputRef = useRef<HTMLInputElement>(null);

  // --- HELPERS ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const toDataUrl = async (url: string): Promise<string> => {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  // --- ACTIONS ---

  const addToWardrobe = async (shopItem: ShopItem) => {
    // Convert shop image URL to base64 for consistency in API calls
    try {
      setProcessing({ isLoading: true, statusMessage: 'Adding to wardrobe...' });
      const base64Url = await toDataUrl(shopItem.image);
      const newItem: WardrobeItem = {
        id: shopItem.id + Date.now(),
        image: base64Url,
        category: shopItem.category,
        description: shopItem.name,
        source: 'store',
        price: shopItem.price,
        brand: shopItem.brand
      };
      setWardrobe(prev => [...prev, newItem]);
    } catch (e) {
      console.error(e);
      setError("Failed to add item to wardrobe.");
    } finally {
      setProcessing({ isLoading: false, statusMessage: '' });
    }
  };

  const styleWithWearly = async (shopItem: ShopItem) => {
    // 1. Add to studio items
    try {
      setProcessing({ isLoading: true, statusMessage: 'Preparing Studio...' });
      const base64Url = await toDataUrl(shopItem.image);
      const newItem: WardrobeItem = {
        id: shopItem.id + Date.now(),
        image: base64Url,
        category: shopItem.category,
        description: shopItem.name,
        source: 'store'
      };
      
      setStudioItems(prev => {
         // Replace item of same category if exists, or add new
         const filtered = prev.filter(i => i.category !== newItem.category);
         return [...filtered, newItem];
      });
      setSection(Section.AVATAR_STUDIO);
    } catch(e) {
      console.error(e);
    } finally {
      setProcessing({ isLoading: false, statusMessage: '' });
    }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setProcessing({ isLoading: true, statusMessage: 'Generating your digital model face...' });
      try {
        const base64 = await fileToBase64(file);
        const avatarResult = await createProfileAvatar({ base64, mimeType: file.type });
        setUserProfile({ avatarImage: avatarResult });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setProcessing({ isLoading: false, statusMessage: '' });
      }
    }
  };

  const handleWardrobeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      const processedImages: string[] = [];
      setProcessing({ isLoading: true, statusMessage: 'Processing items...' });

      try {
        for (const file of newFiles) {
          const base64 = await fileToBase64(file);
          const mimeType = file.type;
          
          // Update status
          setProcessing({ isLoading: true, statusMessage: `Isolating garment ${newFiles.indexOf(file) + 1}/${newFiles.length}...` });

          // 1. Remove background (Isolate garment)
          let processedImage = `data:${mimeType};base64,${base64}`;
          try {
             // We try to remove background using Gemini image editing
             const cleanedBase64 = await removeBackground({ base64, mimeType });
             processedImage = cleanedBase64;
          } catch (bgError) {
             console.error("Background removal failed, using original", bgError);
          }
          processedImages.push(processedImage);
        }
        
        // Push processed images to queue for manual categorization
        setPendingUploads(prev => [...prev, ...processedImages]);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setProcessing({ isLoading: false, statusMessage: '' });
        // Reset file input
        if (wardrobeInputRef.current) wardrobeInputRef.current.value = '';
      }
    }
  };

  const confirmCategory = (category: Category) => {
    if (pendingUploads.length === 0) return;

    const currentImage = pendingUploads[0];
    const newItem: WardrobeItem = {
      id: Date.now() + Math.random().toString(),
      image: currentImage,
      category,
      description: 'Uploaded Item',
      source: 'upload'
    };
    
    setWardrobe(prev => [...prev, newItem]);
    // Remove the processed item from queue
    setPendingUploads(prev => prev.slice(1));
  };

  const discardPendingItem = () => {
    setPendingUploads(prev => prev.slice(1));
  };

  const generateStyle = async () => {
    if (studioItems.length === 0) {
      setError("Please select items to style.");
      return;
    }
    setError(null);
    setGeneratedImage(null);

    const inputs = studioItems.map(item => {
      const parts = item.image.split(',');
      const base64 = parts.length > 1 ? parts[1] : item.image;
      const mimeMatch = item.image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      return { base64, mimeType };
    });

    try {
      setProcessing({ isLoading: true, statusMessage: 'Creating your look...' });
      const result = await generateAvatarStyle(inputs, userProfile.avatarImage || undefined);
      setGeneratedImage(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing({ isLoading: false, statusMessage: '' });
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedWardrobeIds(new Set()); // Clear selection when toggling
  };

  const toggleWardrobeItemSelection = (id: string) => {
    const newSet = new Set(selectedWardrobeIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedWardrobeIds(newSet);
  };

  const styleSelectedOutfit = () => {
    const selectedItems = wardrobe.filter(item => selectedWardrobeIds.has(item.id));
    setStudioItems(selectedItems);
    setSection(Section.AVATAR_STUDIO);
    setIsSelectionMode(false);
    setSelectedWardrobeIds(new Set());
  };

  // --- COMPONENT: HEADER ---
  const Header = () => (
    <header className="fixed top-0 left-0 right-0 h-16 bg-wearly-secondary border-b border-wearly-primary/10 z-50 flex items-center justify-between px-4">
      {/* Spacer for centering */}
      <div className="w-20 hidden md:block"></div>
      
      {/* Logo */}
      <div 
        className="flex-1 text-center cursor-pointer" 
        onClick={() => { setSection(Section.HOME); setSelectedCategory(null); }}
      >
        <span className="font-serif text-3xl font-bold tracking-tight text-wearly-primary drop-shadow-sm select-none">
          WEARLY
        </span>
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-4 text-wearly-primary">
        <button onClick={() => setSection(Section.AVATAR_STUDIO)} title="Style AI">
          <Icon name="mannequin" className="w-6 h-6" />
        </button>
        <button onClick={() => setSection(Section.WARDROBE)} title="My Wardrobe">
          <Icon name="wardrobe" className="w-6 h-6" />
        </button>
        <button className="relative">
          <Icon name="heart" className="w-6 h-6" />
          {favorites.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
        </button>
        <button className="relative">
           <Icon name="cart" className="w-6 h-6" />
           {cart.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
        </button>
        <button className="border border-wearly-primary px-3 py-1 rounded text-xs font-bold uppercase tracking-wider hover:bg-wearly-primary hover:text-white transition-colors">
          Login
        </button>
      </div>
    </header>
  );

  // --- COMPONENT: FOOTER ---
  const Footer = () => (
    <footer className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50 flex items-center justify-around text-wearly-primary/70 pb-safe">
      <button 
        onClick={() => { setSection(Section.HOME); setSelectedCategory(null); }}
        className={`flex flex-col items-center ${section === Section.HOME ? 'text-wearly-primary font-bold' : ''}`}
      >
        <Icon name="home" className="w-6 h-6" fill={section === Section.HOME} />
      </button>
      <button className="flex flex-col items-center">
        <Icon name="search" className="w-6 h-6" />
      </button>
      <button 
        onClick={() => setSection(Section.WARDROBE)}
        className={`flex flex-col items-center ${section === Section.WARDROBE ? 'text-wearly-primary font-bold' : ''}`}
      >
        <Icon name="wardrobe" className="w-6 h-6" fill={section === Section.WARDROBE} />
      </button>
      <button 
        onClick={() => setSection(Section.AVATAR_STUDIO)}
        className={`flex flex-col items-center ${section === Section.AVATAR_STUDIO ? 'text-wearly-primary font-bold' : ''}`}
      >
        <Icon name="mannequin" className="w-6 h-6" fill={section === Section.AVATAR_STUDIO} />
      </button>
    </footer>
  );

  // --- VIEW: HOME ---
  const HomeView = () => (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <h2 className="text-center font-serif text-2xl mb-8 text-wearly-primary">Shop by Category</h2>
      <div className="grid grid-cols-2 gap-4">
        {CATEGORIES.map(cat => (
          <div 
            key={cat.id}
            onClick={() => { setSelectedCategory(cat.id); setSection(Section.SHOP_CATEGORY); }}
            className="aspect-square relative group cursor-pointer overflow-hidden border border-wearly-primary/20 bg-wearly-secondary"
          >
            {/* Using a solid color or pattern if image fails, but wireframe implies clean boxes */}
            <div className="absolute inset-4 border border-wearly-primary flex items-center justify-center z-10 bg-white/80 group-hover:bg-white transition-colors">
               <span className="font-handwriting text-xl font-serif">{cat.label}</span>
            </div>
            <img src={cat.image} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );

  // --- VIEW: SHOP ---
  const ShopView = () => {
    const brands = Array.from(new Set(MOCK_PRODUCTS.map(p => p.brand)));
    const filteredProducts = selectedCategory 
      ? MOCK_PRODUCTS.filter(p => p.category === selectedCategory) 
      : MOCK_PRODUCTS;

    return (
      <div className="pt-20 pb-24">
        <div className="px-4 mb-4 text-center relative">
          <h2 className="font-serif text-3xl border-2 border-wearly-primary inline-block px-8 py-2 transform -skew-x-6">
             {selectedCategory || 'Shop'}
          </h2>
        </div>
        
        {brands.map(brand => {
          const brandProducts = filteredProducts.filter(p => p.brand === brand);
          if (brandProducts.length === 0) return null;

          return (
            <div key={brand} className="mb-8 border-b border-wearly-primary/10 pb-8 last:border-0">
              <h3 className="font-serif text-2xl ml-4 mb-4 underline decoration-wavy decoration-wearly-primary/30">{brand}</h3>
              <div className="flex overflow-x-auto gap-4 px-4 no-scrollbar pb-4">
                {brandProducts.map(product => (
                  <div key={product.id} className="flex-shrink-0 w-48 flex flex-col group">
                    <div className="relative aspect-[3/4] border border-wearly-primary/20 bg-white mb-2 overflow-hidden">
                      <img src={product.image} className="w-full h-full object-cover" />
                      <button className="absolute top-2 right-2 text-wearly-primary hover:text-red-500">
                        <Icon name="heart" className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-start mb-1">
                       <span className="font-bold text-sm">{product.price} LE</span>
                       <span className="text-xs text-gray-500">{product.brand}</span>
                    </div>
                    <button 
                      onClick={() => styleWithWearly(product)}
                      className="w-full border border-wearly-primary text-wearly-primary text-xs py-1.5 mb-1 hover:bg-wearly-primary hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Icon name="sparkles" className="w-3 h-3" />
                      style it w wearly
                    </button>
                    <button 
                      onClick={() => addToWardrobe(product)}
                      className="w-full bg-wearly-primary text-white text-xs py-1.5 hover:bg-wearly-primary/90 transition-colors"
                    >
                      Add to wardrobe
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- VIEW: WARDROBE ---
  const WardrobeView = () => {
    // Defined sections for the mix-and-match layout
    const rows = [
      { id: 'acc', categories: ['Accessory', 'Bag'] },
      { id: 'tops', categories: ['Top', 'Outerwear', 'One-Piece', 'Dresses'] },
      { id: 'bottoms', categories: ['Bottom'] },
      { id: 'shoes', categories: ['Shoes'] }
    ];

    return (
      <div className="min-h-screen flex flex-col bg-white relative pb-24">
         {/* Fixed Controls */}
         <div className="fixed top-4 left-4 z-20 flex gap-2">
             <button 
               onClick={() => wardrobeInputRef.current?.click()} 
               className="bg-white border border-wearly-primary/10 text-wearly-primary px-4 py-2 rounded-full text-sm font-medium shadow-md flex items-center gap-1 hover:bg-wearly-secondary transition-colors"
             >
                <Icon name="plus" className="w-4 h-4" /> Add
             </button>
             <input type="file" multiple ref={wardrobeInputRef} className="hidden" accept="image/*" onChange={handleWardrobeUpload} />
         </div>

         <div className="fixed top-4 right-4 z-20 flex gap-2">
            <button 
              onClick={toggleSelectionMode} 
              className={`px-4 py-2 rounded-full text-sm font-medium shadow-md transition-colors ${
                isSelectionMode 
                  ? 'bg-wearly-primary text-white' 
                  : 'bg-white text-wearly-primary border border-wearly-primary/10 hover:bg-wearly-secondary'
              }`}
            >
                {isSelectionMode ? 'Cancel' : 'Select'}
            </button>
         </div>

         {/* Floating Action Button for Styling Selected Items */}
         {isSelectionMode && selectedWardrobeIds.size > 0 && (
           <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 w-11/12 max-w-sm">
              <button 
                onClick={styleSelectedOutfit}
                className="w-full bg-wearly-primary text-white py-3 rounded-full shadow-xl font-serif text-lg flex items-center justify-center gap-2 animate-in slide-in-from-bottom-4"
              >
                 <Icon name="sparkles" className="w-5 h-5" />
                 Style with WEARLY ({selectedWardrobeIds.size})
              </button>
           </div>
         )}

         {/* Main Mix & Match Area - Vertically Scrollable */}
         <div className="flex-1 flex flex-col pt-20">
            {rows.map((row, index) => {
               const rowItems = wardrobe.filter(item => row.categories.includes(item.category));
               // Use fixed heights to ensure content is visible and scrollable on all devices
               // Accessories & Shoes: ~224px (h-56)
               // Tops & Bottoms: ~320px (h-80)
               let heightClass = "h-56"; 
               if (row.id === 'tops' || row.id === 'bottoms') heightClass = "h-80";
               
               return (
                 <div key={row.id} className={`${heightClass} relative w-full border-b border-gray-50 last:border-0`}>
                    <div className="w-full h-full overflow-x-auto no-scrollbar snap-x snap-mandatory flex items-center">
                        {/* Padding to center the first item */}
                        <div className="shrink-0 w-[calc(50vw-90px)]" /> 
                        
                        {rowItems.length > 0 ? (
                            rowItems.map(item => {
                                const isSelected = selectedWardrobeIds.has(item.id);
                                return (
                                <div 
                                  key={item.id} 
                                  className={`shrink-0 w-[180px] h-full snap-center flex items-center justify-center relative px-2 py-4 cursor-pointer transition-transform ${isSelectionMode ? 'active:scale-95' : ''}`}
                                  onClick={() => {
                                    if (isSelectionMode) {
                                      toggleWardrobeItemSelection(item.id);
                                    }
                                  }}
                                >
                                    <div className={`relative max-h-full max-w-full rounded-lg ${isSelected ? 'ring-4 ring-wearly-primary ring-offset-2' : ''}`}>
                                        <img src={item.image} className="max-h-full max-w-full object-contain drop-shadow-lg" />
                                        
                                        {/* Selection Indicator Overlay */}
                                        {isSelectionMode && (
                                            <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white ${isSelected ? 'bg-wearly-primary' : 'bg-black/20'}`}>
                                                {isSelected && <Icon name="x" className="w-4 h-4 text-white transform rotate-45" />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Pin Icon - only show when not in selection mode */}
                                    {!isSelectionMode && (
                                        <button className="absolute top-1/4 right-2 text-gray-400 hover:text-wearly-primary transition-colors transform hover:scale-110">
                                            <Icon name="pin" className="w-5 h-5 transform rotate-45" />
                                        </button>
                                    )}
                                </div>
                            )})
                        ) : (
                            // Empty State
                             <div className="shrink-0 w-[180px] h-full snap-center flex items-center justify-center">
                                <div className="border-2 border-dashed border-gray-200 rounded-xl w-32 h-32 flex items-center justify-center text-gray-300">
                                    <span className="text-xs font-bold uppercase">{row.id}</span>
                                </div>
                             </div>
                        )}
                        
                        {/* Padding to center the last item */}
                        <div className="shrink-0 w-[calc(50vw-90px)]" />
                    </div>
                 </div>
               );
            })}
         </div>
      </div>
    );
  };

  // --- VIEW: STUDIO ---
  const StudioView = () => (
    <div className="pt-16 pb-16 h-screen flex flex-col md:flex-row overflow-hidden bg-white">
      {/* Main Canvas Area */}
      <div className="flex-1 bg-gray-50 relative flex items-center justify-center p-4">
        {processing.isLoading && <LoadingOverlay message={processing.statusMessage} />}
        
        {generatedImage ? (
          <img src={generatedImage} className="max-w-full max-h-full object-contain shadow-xl" />
        ) : (
          <div className="text-center opacity-30">
            {userProfile.avatarImage ? (
                <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-wearly-primary/20">
                   <img src={userProfile.avatarImage} className="w-full h-full object-cover" />
                </div>
            ) : (
                <Icon name="mannequin" className="w-24 h-24 mx-auto mb-4 text-wearly-primary" />
            )}
            <p className="font-serif text-xl text-wearly-primary">Ready to Style</p>
          </div>
        )}

        {/* Floating Action Button for Generate on Mobile */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 md:hidden z-10 w-4/5">
           <button 
            onClick={generateStyle}
            disabled={studioItems.length === 0 || processing.isLoading}
            className="w-full py-4 bg-wearly-primary text-white font-serif text-lg tracking-wider shadow-lg disabled:opacity-50"
          >
            Click to style with Wearly
          </button>
        </div>
      </div>

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-white border-l border-gray-100 flex flex-col z-20 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.1)]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-wearly-secondary/30">
          <h2 className="font-serif text-2xl text-wearly-primary transform -rotate-2 origin-left border border-wearly-primary px-4 bg-white inline-block">Style</h2>
          
          <div className="flex gap-2">
             {/* Profile Upload Mini */}
             <button 
               onClick={() => avatarInputRef.current?.click()}
               className="w-8 h-8 rounded-full border border-wearly-primary flex items-center justify-center overflow-hidden"
               title="Set Model Face"
             >
               {userProfile.avatarImage ? <img src={userProfile.avatarImage} className="w-full h-full object-cover"/> : <Icon name="user" className="w-4 h-4"/>}
             </button>
             <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleProfileUpload} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           {/* Slots in logical order */}
           {['Accessory', 'Top', 'Bottom', 'Shoes', 'Bag'].map(cat => {
              // Group some categories for simpler UI
              const displayCat = cat === 'Top' ? 'Tops & Dresses' : cat;
              // Find item matching this main type or related subtypes
              const item = studioItems.find(i => {
                 if (cat === 'Top') return ['Top', 'Outerwear', 'One-Piece', 'Dresses'].includes(i.category);
                 return i.category === cat;
              });

              return (
                <div key={cat} className="border border-wearly-primary p-2">
                   <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center relative mb-2">
                      {item ? (
                        <>
                          <img src={item.image} className="w-full h-full object-contain" />
                          <button 
                            onClick={() => setStudioItems(prev => prev.filter(i => i.id !== item.id))}
                            className="absolute top-1 right-1 text-red-500 hover:bg-white rounded-full p-1"
                          >
                            <Icon name="x" className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-300 font-serif text-2xl">{displayCat}</span>
                      )}
                   </div>
                   
                   {/* Selection Controls */}
                   <div className="flex items-center justify-between border border-wearly-primary px-2 py-1">
                      <button className="text-wearly-primary font-bold hover:bg-gray-100 px-2">-</button>
                      <span className="font-mono text-sm">1</span>
                      <button 
                        onClick={() => {
                           alert("Select an item from Shop or Wardrobe to add here!");
                        }}
                        className="text-wearly-primary font-bold hover:bg-gray-100 px-2"
                      >+</button>
                   </div>
                </div>
              );
           })}
        </div>

        {/* Desktop Generate Button */}
        <div className="p-4 border-t border-gray-100 hidden md:block">
           <button 
            onClick={generateStyle}
            disabled={studioItems.length === 0 || processing.isLoading}
            className="w-full py-4 bg-wearly-primary text-white font-serif text-xl transform hover:-translate-y-1 transition-transform border-2 border-transparent hover:border-wearly-primary hover:bg-white hover:text-wearly-primary"
          >
            Click to style with Wearly
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-wearly-primary bg-white selection:bg-wearly-secondary selection:text-wearly-primary">
      {/* Show header everywhere except Wardrobe for the full-screen effect in Wardrobe */}
      {section !== Section.WARDROBE && <Header />}
      
      <main className="min-h-screen">
        {error && (
          <div className="fixed top-20 left-4 right-4 z-50 p-4 bg-red-50 border border-red-200 text-red-800 rounded flex justify-between items-center shadow-lg">
            <span>{error}</span>
            <button onClick={() => setError(null)}><Icon name="x" className="w-4 h-4" /></button>
          </div>
        )}

        {/* Category Selection Modal */}
        {pendingUploads.length > 0 && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl p-6 w-full max-w-sm relative flex flex-col items-center shadow-2xl animate-in fade-in zoom-in duration-200">
               <button onClick={discardPendingItem} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-2">
                 <Icon name="x" className="w-5 h-5" />
               </button>

               <h3 className="font-serif text-2xl mb-2 text-wearly-primary">Categorize Item</h3>
               <p className="text-sm text-gray-500 mb-4">Where does this belong in your closet?</p>
               
               <div className="w-48 h-48 mb-6 border border-wearly-primary/10 rounded-lg p-4 flex items-center justify-center bg-wearly-secondary/20">
                 <img src={pendingUploads[0]} className="max-w-full max-h-full object-contain drop-shadow-md" />
               </div>

               <div className="grid grid-cols-2 gap-3 w-full">
                  <button onClick={() => confirmCategory('Accessory')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Scarves / Hats</button>
                  <button onClick={() => confirmCategory('Top')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Tops</button>
                  <button onClick={() => confirmCategory('Bottom')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Bottoms</button>
                  <button onClick={() => confirmCategory('Shoes')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Shoes</button>
                  <button onClick={() => confirmCategory('Bag')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Bags</button>
                  <button onClick={() => confirmCategory('Accessory')} className="py-3 px-2 border border-wearly-primary/30 rounded hover:bg-wearly-primary hover:text-white transition-all text-sm font-medium">Accessories</button>
               </div>
               
               <div className="mt-4 text-xs text-gray-400 font-medium">
                  {pendingUploads.length} item{pendingUploads.length > 1 ? 's' : ''} remaining
               </div>
            </div>
          </div>
        )}

        {section === Section.HOME && <HomeView />}
        {section === Section.SHOP_CATEGORY && <ShopView />}
        {section === Section.WARDROBE && <WardrobeView />}
        {section === Section.AVATAR_STUDIO && <StudioView />}
      </main>

      <Footer />
    </div>
  );
};

export default App;