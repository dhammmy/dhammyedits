import React, { useState, useRef, useEffect } from 'react';
import { Camera, UploadCloud, X, Mail, Image as ImageIcon, Menu, Trash2, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
// Initialize outside of the component to prevent re-initialization on renders
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const CATEGORIES = [
  'Portraits', 'Landscapes', 'Weddings', 'Fashion', 'Architecture', 
  'Street', 'Product', 'Fine Art', 'Sports', 'Editorial'
];

export default function PortfolioApp() {
  const [user, setUser] = useState(null);
  const [dbImages, setDbImages] = useState([]);
  const [currentView, setCurrentView] = useState('home'); // 'home', 'contact', or category name
  const [selectedImage, setSelectedImage] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- FIREBASE AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Authentication Error:', error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- FIREBASE DATA FETCHING ---
  useEffect(() => {
    if (!user) return;

    const imagesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'portfolio_images');
    
    // Using a simple collection query (No complex queries as per rules)
    const unsubscribe = onSnapshot(imagesRef, (snapshot) => {
      const fetched = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort in-memory by newest first
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setDbImages(fetched);
    }, (error) => {
      console.error('Firestore Read Error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [selectedImage]);

  // --- IMAGE COMPRESSION ENGINE ---
  // Compresses image heavily to fit comfortably within Firestore's 1MB document limit
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export as JPEG with 0.6 quality for substantial size reduction
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  // --- UPLOAD HANDLER ---
  const handleFileUpload = async (e, category) => {
    if (!user) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    for (const file of files) {
      try {
        const compressedDataUrl = await compressImage(file);
        const imagesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'portfolio_images');
        
        await addDoc(imagesRef, {
          category,
          dataUrl: compressedDataUrl,
          createdAt: Date.now()
        });
      } catch (error) {
        console.error("Error compressing/uploading image:", error);
      }
    }
    
    setIsUploading(false);
    e.target.value = ''; // Reset input
  };

  // --- DELETE HANDLER ---
  const handleDeleteImage = async (imageId) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'portfolio_images', imageId);
      await deleteDoc(docRef);
      setSelectedImage(null); // Close lightbox after deletion
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // --- COMPONENT: Navigation / Header ---
  const Header = () => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div 
            className="flex flex-col cursor-pointer group"
            onClick={() => setCurrentView('home')}
          >
            <div className="flex items-center">
              <Camera className="w-6 h-6 text-gray-900 mr-2 group-hover:text-gray-600 transition-colors" />
              <h1 className="text-2xl font-semibold tracking-tighter text-gray-900 group-hover:text-gray-600 transition-colors">
                dhammy<span className="font-light text-gray-500">edits</span>
              </h1>
            </div>
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase mt-1">
              Photographer: Dhammy
            </span>
          </div>

          <nav className="hidden md:flex space-x-8">
            <button 
              onClick={() => setCurrentView('home')}
              className={`text-sm font-medium tracking-wide uppercase transition-colors ${currentView === 'home' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setCurrentView('contact')}
              className={`text-sm font-medium tracking-wide uppercase transition-colors ${currentView === 'contact' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Contact
            </button>
          </nav>

          <button 
            className="md:hidden p-2 text-gray-500 hover:text-gray-900 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-4">
              <button 
                onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }}
                className="text-left text-sm font-medium text-gray-600 uppercase tracking-wide"
              >
                Home
              </button>
              <button 
                onClick={() => { setCurrentView('contact'); setIsMobileMenuOpen(false); }}
                className="text-left text-sm font-medium text-gray-600 uppercase tracking-wide"
              >
                Contact
              </button>
            </div>
          </div>
        )}
      </div>

      {currentView !== 'contact' && (
        <div className="bg-gray-50 border-t border-gray-200 py-3 overflow-x-auto no-scrollbar">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-6 min-w-max">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setCurrentView(category)}
                className={`text-xs uppercase tracking-wider whitespace-nowrap transition-colors ${
                  currentView === category 
                    ? 'text-gray-900 font-bold border-b border-gray-900 pb-1' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );

  // --- COMPONENT: Masonry Grid ---
  const MasonryGrid = ({ images }) => {
    if (images.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <ImageIcon className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-lg font-light text-gray-600">No images uploaded yet.</p>
        </div>
      );
    }

    return (
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {images.map((imgObj) => (
          <div 
            key={imgObj.id} 
            className="break-inside-avoid overflow-hidden rounded-sm group relative cursor-pointer"
            onClick={() => setSelectedImage(imgObj)}
          >
            <img 
              src={imgObj.dataUrl} 
              alt={`Gallery view in ${imgObj.category}`} 
              className="w-full h-auto object-cover border border-gray-200 grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
          </div>
        ))}
      </div>
    );
  };

  // --- COMPONENT: Home View ---
  const HomeView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-light text-gray-900 tracking-wider">Galleries</h2>
        <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest">Select a collection</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {CATEGORIES.map(category => {
          // Find the most recent image for this category to use as a cover
          const categoryImages = dbImages.filter(img => img.category === category);
          const coverImage = categoryImages.length > 0 ? categoryImages[0].dataUrl : null;
          
          return (
            <div 
              key={category}
              onClick={() => setCurrentView(category)}
              className="group relative h-64 sm:h-80 cursor-pointer overflow-hidden rounded-sm border border-gray-200 bg-gray-50 flex items-center justify-center"
            >
              {coverImage ? (
                <img 
                  src={coverImage} 
                  alt={`${category} cover`} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-300 transition-transform duration-500 group-hover:scale-110" />
              )}
              
              {/* Overlay for text legibility */}
              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-500" />
              
              {/* Title & Meta */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <h3 className="text-white text-2xl font-light tracking-widest uppercase text-center drop-shadow-md">
                  {category}
                </h3>
                <span className="text-gray-200 text-xs mt-3 tracking-widest uppercase drop-shadow-md font-medium">
                  {categoryImages.length} {categoryImages.length === 1 ? 'Photo' : 'Photos'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- COMPONENT: Gallery View ---
  const GalleryView = () => {
    const fileInputRef = useRef(null);
    const categoryImages = dbImages.filter(img => img.category === currentView);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6">
          <div>
            <h2 className="text-3xl font-light text-gray-900 tracking-wider">{currentView}</h2>
            <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest">{categoryImages.length} {categoryImages.length === 1 ? 'Photo' : 'Photos'}</p>
          </div>

          <div>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e, currentView)}
              disabled={isUploading || !user}
            />
            <button 
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading || !user}
              className="flex items-center bg-gray-900 text-white px-6 py-2.5 rounded shadow hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              <span className="text-sm font-medium tracking-wide uppercase">
                {isUploading ? 'Processing...' : `Upload to ${currentView}`}
              </span>
            </button>
          </div>
        </div>

        <MasonryGrid images={categoryImages} />
      </div>
    );
  };

  // --- COMPONENT: Contact View ---
  const ContactView = () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-3xl font-light text-gray-900 tracking-wider mb-2">Get in Touch</h2>
        <p className="text-gray-500">Available for freelance opportunities and collaborations.</p>
      </div>

      <form className="bg-white p-8 border border-gray-200 shadow-sm rounded-sm" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">Name</label>
            <input 
              type="text" 
              id="name" 
              className="w-full px-4 py-3 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
              placeholder="Your Name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">Email</label>
            <input 
              type="email" 
              id="email" 
              className="w-full px-4 py-3 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">Message</label>
            <textarea 
              id="message" 
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none"
              placeholder="Tell me about your project..."
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-gray-900 text-white font-medium tracking-wide uppercase py-4 rounded hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Send Message
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Header />

      <main className="min-h-[calc(100vh-8rem)]">
        {!user && (
          <div className="bg-gray-100 p-4 text-center text-sm text-gray-600 border-b border-gray-200">
            <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Authenticating securely...
          </div>
        )}
        
        {currentView === 'home' && <HomeView />}
        {currentView === 'contact' && <ContactView />}
        {CATEGORIES.includes(currentView) && <GalleryView />}
      </main>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          {/* Top Actions */}
          <div className="absolute top-6 right-6 flex items-center space-x-6">
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteImage(selectedImage.id); }}
              className="text-gray-400 hover:text-red-500 transition-colors focus:outline-none flex flex-col items-center"
              title="Delete Image"
            >
              <Trash2 className="w-6 h-6" />
              <span className="text-[10px] uppercase mt-1 tracking-widest">Delete</span>
            </button>

            <button 
              className="text-gray-400 hover:text-white transition-colors focus:outline-none"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          
          <img 
            src={selectedImage.dataUrl} 
            alt="Expanded view" 
            className="max-w-full max-h-full object-contain select-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="absolute bottom-6 left-6 text-gray-400 text-sm uppercase tracking-widest pointer-events-none">
            {selectedImage.category}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} dhammyedits. All rights reserved.</p>
        <p className="mt-1 text-xs uppercase tracking-widest">Photographer: Dhammy</p>
      </footer>
    </div>
  );
}