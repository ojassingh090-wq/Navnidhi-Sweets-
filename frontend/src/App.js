import React, { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  MessageSquare, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  User, 
  Lock, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  Menu, 
  X, 
  Check, 
  Eye, 
  Shield, 
  Award, 
  Clock,
  Sparkles,
  Heart,
  ChevronRight,
  LogOut,
  Send,
  Sliders,
  AlertCircle
} from "lucide-react";
import axios from "axios";
import { Toaster, toast } from "./components/ui/sonner";
import "@/App.css";

// Configure Backend URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://natural-sweets-store.preview.emergentagent.com";
const API = `${BACKEND_URL}/api`;

// Configure axios with credentials for secure JWT httpOnly cookies
axios.defaults.withCredentials = true;

// Helper to format API error message safely
function formatApiError(error) {
  if (!error) return "Something went wrong. Please try again.";
  const detail = error.response?.data?.detail;
  if (detail == null) return error.message || "An error occurred.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map(e => e?.msg || JSON.stringify(e)).join(", ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function App() {
  // Navigation & Page State
  const [activeTab, setActiveTab] = useState("Home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  
  // Products, Catalog & Search State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Sweets"); // Sweets, Bhaji, Snacks, Gifting
  const [searchQuery, setSearchQuery] = useState("");
  const [weightChoices, setWeightChoices] = useState({}); // productId -> "250g" | "500g" | "1kg"
  
  // Cart State
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("navnidhi_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [customerName, setCustomerName] = useState("");
  
  // Testimonials / Reviews State
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ name: "", rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Contact Inquiry Form State
  const [inquiry, setInquiry] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  
  // Admin & Auth State
  const [user, setUser] = useState(null); // null = checked/checking, false = guest, Object = admin
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  // Admin Dashboard State
  const [adminTab, setAdminTab] = useState("products"); // products, inquiries, reviews, create-product
  const [adminInquiries, setAdminInquiries] = useState([]);
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  
  // Admin Editing Product State
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    category: "Khoya Items",
    item: "",
    is_sweet: true,
    price_250g: "",
    price_500g: "",
    price_1kg: "",
    description: "",
    price: "",
    unit: "Kg",
    image_url: "",
    is_featured: false,
    in_stock: true
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // References for scrolling
  const catalogRef = useRef(null);
  const contactRef = useRef(null);
  const reviewsRef = useRef(null);

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem("navnidhi_cart", JSON.stringify(cart));
  }, [cart]);

  // Auth Status Check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await axios.get(`${API}/auth/me`);
        setUser(data);
      } catch (e) {
        setUser(false);
      } finally {
        setAdminCheckDone(true);
      }
    };
    checkAuth();
  }, []);

  // Fetch Public Products & Reviews
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingProducts(true);
        const [prodRes, revRes] = await Promise.all([
          axios.get(`${API}/products`),
          axios.get(`${API}/reviews`)
        ]);
        setProducts(prodRes.data);
        setReviews(revRes.data);
        
        // Setup initial weights for sweets
        const initialWeights = {};
        prodRes.data.forEach(p => {
          if (p.is_sweet) {
            initialWeights[p._id] = "1kg";
          }
        });
        setWeightChoices(initialWeights);
      } catch (e) {
        console.error("Error fetching homepage data:", e);
        toast.error("Failed to load products and reviews. Please reload.");
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchData();
  }, []);

  // Fetch Admin-only data if logged in
  useEffect(() => {
    if (user && user.role === "admin") {
      const fetchAdminData = async () => {
        try {
          const [inqRes, revRes] = await Promise.all([
            axios.get(`${API}/inquiries`),
            axios.get(`${API}/admin/reviews`)
          ]);
          setAdminInquiries(inqRes.data);
          setAdminReviews(revRes.data);
        } catch (e) {
          console.error("Error fetching admin dashboard data:", e);
        }
      };
      fetchAdminData();
    }
  }, [user]);

  // Scroll to section helper
  const scrollTo = (ref, tabName) => {
    setActiveTab(tabName);
    setMobileMenuOpen(false);
    if (tabName === "Home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // --- Cart Helpers ---
  const addToCart = (product) => {
    const weightChoice = weightChoices[product._id];
    let cartItemId = product._id;
    let displayName = product.item;
    let displayPrice = product.price;
    let selectedUnit = product.unit;

    if (product.is_sweet && weightChoice) {
      cartItemId = `${product._id}-${weightChoice}`;
      selectedUnit = weightChoice;
      if (weightChoice === "250g") {
        displayPrice = product.price_250g || (product.price / 4);
      } else if (weightChoice === "500g") {
        displayPrice = product.price_500g || (product.price / 2);
      } else {
        displayPrice = product.price_1kg || product.price;
      }
      displayName = `${product.item} (${weightChoice})`;
    }

    const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        cartItemId,
        productId: product._id,
        item: product.item,
        displayName,
        price: displayPrice,
        unit: selectedUnit,
        quantity: 1,
        image_url: product.image_url,
        is_sweet: product.is_sweet
      }]);
    }
    toast.success(`${displayName} added to order list!`);
  };

  const updateCartQty = (cartItemId, change) => {
    const updated = cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean);
    setCart(updated);
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
    toast.info("Item removed from list.");
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // Send WhatsApp Lead
  const handleWhatsAppCheckout = () => {
    if (cart.length === 0) {
      toast.error("Your order list is empty.");
      return;
    }
    
    const storeWhatsApp = "919876543210"; // Pre-defined shop number
    let orderMsg = `*NAVNIDHI SWEETS - NEW ORDER INQUIRY* 🌟\n`;
    orderMsg += `_Taste Crafted with Purity_\n`;
    orderMsg += `=================================\n`;
    if (customerName.trim()) {
      orderMsg += `*Customer Name:* ${customerName.trim()}\n`;
    }
    orderMsg += `*Date:* ${new Date().toLocaleDateString()}\n`;
    orderMsg += `=================================\n\n`;
    
    cart.forEach((item, index) => {
      orderMsg += `*${index + 1}. ${item.displayName}*\n`;
      orderMsg += `   Qty: ${item.quantity} | Price: ₹${item.price} per ${item.unit}\n`;
      orderMsg += `   Subtotal: ₹${item.price * item.quantity}\n\n`;
    });
    
    orderMsg += `=================================\n`;
    orderMsg += `*Total Order Value:* ₹${cartTotal}\n`;
    orderMsg += `=================================\n\n`;
    orderMsg += `Please confirm availability and prepare the order for pickup/delivery! 🙏`;
    
    const encoded = encodeURIComponent(orderMsg);
    const waUrl = `https://wa.me/${storeWhatsApp}?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success("Redirecting to WhatsApp to complete your order inquiry!");
  };

  // --- Form Submissions ---
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!inquiry.name || !inquiry.phone || !inquiry.message) {
      toast.error("Please fill out Name, Phone, and Message fields.");
      return;
    }
    setSubmittingInquiry(true);
    try {
      await axios.post(`${API}/inquiries`, inquiry);
      toast.success("Thank you! Your inquiry has been submitted. Our team will contact you shortly.");
      setInquiry({ name: "", phone: "", email: "", subject: "", message: "" });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.name || !newReview.comment) {
      toast.error("Please provide your Name and Comments.");
      return;
    }
    setSubmittingReview(true);
    try {
      const { data } = await axios.post(`${API}/reviews`, newReview);
      setReviews([data, ...reviews]);
      toast.success("Review submitted! Thank you for sharing your experience.");
      setNewReview({ name: "", rating: 5, comment: "" });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmittingReview(false);
    }
  };

  // --- Admin Auth Actions ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email: loginEmail,
        password: loginPassword
      });
      setUser(data);
      toast.success(`Welcome back, ${data.name}!`);
      // Reset credentials fields
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setLoginError(formatApiError(err));
      toast.error("Authentication failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(false);
      toast.info("Logged out successfully.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // --- Admin Dashboard Actions ---
  const handleDeleteInquiry = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inquiry?")) return;
    try {
      await axios.delete(`${API}/inquiries/${id}`);
      setAdminInquiries(adminInquiries.filter(q => q._id !== id));
      toast.success("Inquiry lead deleted.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleResolveInquiry = async (id) => {
    try {
      const { data } = await axios.put(`${API}/inquiries/${id}/resolve`);
      setAdminInquiries(adminInquiries.map(q => q._id === id ? data : q));
      toast.success("Inquiry marked as resolved.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleToggleApproveReview = async (id) => {
    try {
      const { data } = await axios.put(`${API}/admin/reviews/${id}/toggle-approve`);
      setAdminReviews(adminReviews.map(r => r._id === id ? data : r));
      // Refresh approved list
      const approvedList = await axios.get(`${API}/reviews`);
      setReviews(approvedList.data);
      toast.success("Review approval state updated.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleDeleteReviewAdmin = async (id) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await axios.delete(`${API}/admin/reviews/${id}`);
      setAdminReviews(adminReviews.filter(r => r._id !== id));
      // Refresh approved list
      const approvedList = await axios.get(`${API}/reviews`);
      setReviews(approvedList.data);
      toast.success("Review deleted successfully.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // --- Admin Product CRUD ---
  const handleEditProduct = (prod) => {
    setEditingProduct(prod._id);
    setProductForm({
      category: prod.category,
      item: prod.item,
      is_sweet: prod.is_sweet,
      price_250g: prod.price_250g || "",
      price_500g: prod.price_500g || "",
      price_1kg: prod.price_1kg || "",
      description: prod.description || "",
      price: prod.price,
      unit: prod.unit || "Kg",
      image_url: prod.image_url || "",
      is_featured: prod.is_featured || false,
      in_stock: prod.in_stock !== false
    });
    setAdminTab("edit-product");
  };

  const handleCreateProductInit = () => {
    setEditingProduct(null);
    setProductForm({
      category: "Khoya Items",
      item: "",
      is_sweet: true,
      price_250g: "",
      price_500g: "",
      price_1kg: "",
      description: "",
      price: "",
      unit: "Kg",
      image_url: "",
      is_featured: false,
      in_stock: true
    });
    setAdminTab("edit-product");
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.item || !productForm.price) {
      toast.error("Please fill in Product Name and Base Price.");
      return;
    }
    setSavingProduct(true);
    
    // Parse values
    const payload = {
      ...productForm,
      price: parseFloat(productForm.price),
      price_250g: productForm.price_250g ? parseFloat(productForm.price_250g) : null,
      price_500g: productForm.price_500g ? parseFloat(productForm.price_500g) : null,
      price_1kg: productForm.price_1kg ? parseFloat(productForm.price_1kg) : null,
    };

    try {
      if (editingProduct) {
        // Update product
        const { data } = await axios.put(`${API}/products/${editingProduct}`, payload);
        setProducts(products.map(p => p._id === editingProduct ? data : p));
        toast.success("Product updated successfully!");
      } else {
        // Create product
        const { data } = await axios.post(`${API}/products`, payload);
        setProducts([data, ...products]);
        toast.success("New product added successfully!");
      }
      setAdminTab("products");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      setProducts(products.filter(p => p._id !== id));
      toast.success("Product deleted successfully.");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // --- Filtering & Categories ---
  const publicFilteredProducts = products.filter(p => {
    // Category mapping
    let matchesTab = false;
    if (selectedCategory === "Sweets") {
      matchesTab = ["Khoya Items", "Kaju & Dryfruit Sweets", "Ghee & Besan Items", "Sugar Free Sweets"].includes(p.category);
    } else if (selectedCategory === "Snacks") {
      matchesTab = ["Snacks", "CHAAT", "DESI DELIGHTS"].includes(p.category);
    } else if (selectedCategory === "Gifting") {
      matchesTab = p.category === "Gifting" || p.item.toLowerCase().includes("box") || p.item.toLowerCase().includes("hampers");
    } else if (selectedCategory === "Bhaji") {
      matchesTab = p.category === "Bhaji" || p.item.toLowerCase().includes("bhaji");
    }
    
    // Search query matching
    const matchesSearch = p.item.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
                          
    return matchesTab && matchesSearch;
  });

  const adminFilteredProducts = products.filter(p => 
    p.item.toLowerCase().includes(adminSearchQuery.toLowerCase()) || 
    p.category.toLowerCase().includes(adminSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Sonner Toaster notifications */}
      <Toaster position="top-right" closeButton richColors theme="dark" />

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0A0A]/85 border-b border-[#D4AF37]/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => scrollTo(null, "Home")} 
            className="flex items-center space-x-3 cursor-pointer group"
            data-testid="brand-logo-trigger"
          >
            <img 
              src="https://customer-assets.emergentagent.com/job_natural-sweets-store/artifacts/fvh7hzey_file_00000000b6e071fa838a7b01e5de191c.png" 
              alt="Navnidhi Sweets" 
              className="h-12 w-12 object-contain group-hover:scale-105 transition-transform duration-300 border border-[#D4AF37]/20 rounded-full bg-[#111]"
            />
            <div className="flex flex-col">
              <span className="font-serif text-2xl tracking-wide text-[#D4AF37] font-medium leading-none">NAVNIDHI</span>
              <span className="text-[9px] tracking-[0.25em] uppercase text-gray-400 mt-1">Taste Crafted with Purity</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <button 
              onClick={() => scrollTo(null, "Home")}
              className={`text-sm tracking-widest uppercase transition-colors duration-200 ${activeTab === "Home" ? "text-[#D4AF37] font-medium" : "text-gray-400 hover:text-[#D4AF37]"}`}
              data-testid="nav-link-home"
            >
              Home
            </button>
            <button 
              onClick={() => scrollTo(catalogRef, "Sweets")}
              className={`text-sm tracking-widest uppercase transition-colors duration-200 ${activeTab === "Sweets" ? "text-[#D4AF37] font-medium" : "text-gray-400 hover:text-[#D4AF37]"}`}
              data-testid="nav-link-products"
            >
              Our Sweets
            </button>
            <button 
              onClick={() => scrollTo(reviewsRef, "Reviews")}
              className={`text-sm tracking-widest uppercase transition-colors duration-200 ${activeTab === "Reviews" ? "text-[#D4AF37] font-medium" : "text-gray-400 hover:text-[#D4AF37]"}`}
              data-testid="nav-link-reviews"
            >
              Reviews
            </button>
            <button 
              onClick={() => scrollTo(contactRef, "Contact")}
              className={`text-sm tracking-widest uppercase transition-colors duration-200 ${activeTab === "Contact" ? "text-[#D4AF37] font-medium" : "text-gray-400 hover:text-[#D4AF37]"}`}
              data-testid="nav-link-contact"
            >
              Contact Us
            </button>
            {user && (
              <button 
                onClick={() => setActiveTab("Admin")}
                className={`text-sm tracking-widest uppercase transition-colors duration-200 flex items-center gap-1 ${activeTab === "Admin" ? "text-[#E5C865] font-medium" : "text-gray-300 hover:text-[#E5C865]"}`}
                data-testid="nav-link-admin"
              >
                <Sliders className="h-3.5 w-3.5" /> Admin
              </button>
            )}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            {/* Cart Trigger */}
            <button 
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-full border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 bg-[#111] text-[#D4AF37] transition-all duration-300"
              data-testid="cart-toggle-btn"
              aria-label="Open Order List"
            >
              <ShoppingBag className="h-5 w-5" />
              {cart.length > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-[#D4AF37] text-[#0A0A0A] font-bold text-xs h-5 w-5 rounded-full flex items-center justify-center animate-pulse"
                  data-testid="cart-item-count"
                >
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            {/* Header Order Now button */}
            <button 
              onClick={() => scrollTo(catalogRef, "Sweets")}
              className="hidden sm:inline-flex bg-[#D4AF37] text-[#0A0A0A] text-xs font-semibold uppercase tracking-wider px-5 py-2.5 hover:bg-[#E5C865] transition-all duration-300"
              data-testid="header-order-now-btn"
            >
              Explore Products
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 lg:hidden text-gray-400 hover:text-white transition-colors duration-200"
              data-testid="mobile-menu-toggle-btn"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#D4AF37]/10 bg-[#111111]/95 px-6 py-6 space-y-4">
            <button 
              onClick={() => scrollTo(null, "Home")}
              className="block w-full text-left text-sm tracking-widest uppercase py-2 text-gray-300 hover:text-[#D4AF37]"
              data-testid="mobile-nav-link-home"
            >
              Home
            </button>
            <button 
              onClick={() => scrollTo(catalogRef, "Sweets")}
              className="block w-full text-left text-sm tracking-widest uppercase py-2 text-gray-300 hover:text-[#D4AF37]"
              data-testid="mobile-nav-link-products"
            >
              Our Sweets
            </button>
            <button 
              onClick={() => scrollTo(reviewsRef, "Reviews")}
              className="block w-full text-left text-sm tracking-widest uppercase py-2 text-gray-300 hover:text-[#D4AF37]"
              data-testid="mobile-nav-link-reviews"
            >
              Reviews
            </button>
            <button 
              onClick={() => scrollTo(contactRef, "Contact")}
              className="block w-full text-left text-sm tracking-widest uppercase py-2 text-gray-300 hover:text-[#D4AF37]"
              data-testid="mobile-nav-link-contact"
            >
              Contact Us
            </button>
            {user && (
              <button 
                onClick={() => { setActiveTab("Admin"); setMobileMenuOpen(false); }}
                className="block w-full text-left text-sm tracking-widest uppercase py-2 text-[#E5C865] hover:text-white flex items-center gap-2"
                data-testid="mobile-nav-link-admin"
              >
                <Sliders className="h-4 w-4" /> Admin Panel
              </button>
            )}
          </div>
        )}
      </header>

      {/* --- CONTENT ROUTER --- */}
      {activeTab === "Admin" ? (
        // ADMIN DASHBOARD
        <div className="flex-grow max-w-7xl mx-auto w-full px-6 sm:px-8 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#D4AF37]/20 pb-6 mb-8 gap-4">
            <div>
              <h1 className="font-serif text-4xl text-[#D4AF37] font-medium">Admin Management</h1>
              <p className="text-sm text-gray-400 mt-1">Control your products, view inquiry leads, and moderate reviews.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Logged in as Administrator
              </span>
              <button 
                onClick={handleLogout}
                className="bg-red-950/20 text-red-400 border border-red-900/30 px-4 py-2 hover:bg-red-900/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                data-testid="admin-logout-btn"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>

          {/* Admin Navigation Tabs */}
          <div className="flex border-b border-white/10 mb-8 overflow-x-auto gap-2">
            <button 
              onClick={() => setAdminTab("products")}
              className={`px-5 py-3 text-sm font-semibold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${adminTab === "products" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-gray-400 hover:text-white"}`}
              data-testid="admin-tab-products"
            >
              Products ({products.length})
            </button>
            <button 
              onClick={() => setAdminTab("inquiries")}
              className={`px-5 py-3 text-sm font-semibold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${adminTab === "inquiries" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-gray-400 hover:text-white"}`}
              data-testid="admin-tab-inquiries"
            >
              Inquiries/Leads ({adminInquiries.length})
            </button>
            <button 
              onClick={() => setAdminTab("reviews")}
              className={`px-5 py-3 text-sm font-semibold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${adminTab === "reviews" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-gray-400 hover:text-white"}`}
              data-testid="admin-tab-reviews"
            >
              Testimonials ({adminReviews.length})
            </button>
          </div>

          {/* TAB PANELS */}
          {adminTab === "products" && (
            <div>
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mb-6">
                <div className="relative flex-grow max-w-md">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search product catalog..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded px-10 py-2 text-sm focus:border-[#D4AF37] outline-none transition-colors"
                    data-testid="admin-product-search"
                  />
                </div>
                <button 
                  onClick={handleCreateProductInit}
                  className="bg-[#D4AF37] text-[#0A0A0A] font-semibold text-xs uppercase tracking-wider px-5 py-3 hover:bg-[#E5C865] flex items-center justify-center gap-1.5 transition-colors"
                  data-testid="admin-create-product-btn"
                >
                  <Plus className="h-4 w-4" /> Add Product
                </button>
              </div>

              <div className="overflow-x-auto border border-white/10 rounded bg-[#111]/40">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#111] text-gray-300 font-serif border-b border-white/10 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4">Item</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price details</th>
                      <th className="p-4">Featured</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminFilteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-gray-500">No products found matching your search.</td>
                      </tr>
                    ) : (
                      adminFilteredProducts.map(p => (
                        <tr key={p._id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-serif font-medium">{p.item}</td>
                          <td className="p-4"><span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded text-gray-300">{p.category}</span></td>
                          <td className="p-4">
                            {p.is_sweet ? (
                              <div className="text-xs space-y-0.5 text-gray-400">
                                <div>250g: ₹{p.price_250g || (p.price/4)}</div>
                                <div>500g: ₹{p.price_500g || (p.price/2)}</div>
                                <div>1Kg: ₹{p.price_1kg || p.price}</div>
                              </div>
                            ) : (
                              <span className="font-semibold text-[#D4AF37]">₹{p.price} / {p.unit}</span>
                            )}
                          </td>
                          <td className="p-4">
                            {p.is_featured ? (
                              <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-950/20 border border-yellow-800/30 px-2 py-0.5 rounded">Featured</span>
                            ) : (
                              <span className="text-[10px] text-gray-500">Standard</span>
                            )}
                          </td>
                          <td className="p-4">
                            {p.in_stock !== false ? (
                              <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-950/20 border border-emerald-800/30 px-2 py-0.5 rounded">In Stock</span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-red-500 bg-red-950/20 border border-red-800/30 px-2 py-0.5 rounded">Out of Stock</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleEditProduct(p)}
                                className="p-1.5 border border-white/10 rounded hover:border-[#D4AF37] hover:text-[#D4AF37] text-gray-400 transition-colors"
                                title="Edit Product"
                                data-testid={`admin-edit-prod-${p._id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(p._id)}
                                className="p-1.5 border border-white/10 rounded hover:border-red-500 hover:text-red-500 text-gray-400 transition-colors"
                                title="Delete Product"
                                data-testid={`admin-delete-prod-${p._id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === "inquiries" && (
            <div className="space-y-6">
              {adminInquiries.length === 0 ? (
                <div className="text-center p-12 border border-white/10 rounded bg-[#111]/40 text-gray-400">
                  <MessageSquare className="h-10 w-10 text-[#D4AF37] mx-auto mb-4 opacity-50" />
                  No inquiries or leads received yet.
                </div>
              ) : (
                adminInquiries.map(q => (
                  <div key={q._id} className="border border-white/10 bg-[#111]/40 p-6 rounded relative flex flex-col md:flex-row justify-between gap-4 hover:border-[#D4AF37]/30 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-xl font-semibold text-white">{q.name}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${q.status === "resolved" ? "text-emerald-500 bg-emerald-950/20 border-emerald-900/30" : "text-amber-500 bg-yellow-950/20 border-yellow-900/30"}`}>
                          {q.status || "pending"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-[#D4AF37]" /> {q.phone}</div>
                        {q.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-[#D4AF37]" /> {q.email}</div>}
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-[#D4AF37]" /> {new Date(q.created_at).toLocaleString()}</div>
                      </div>

                      {q.subject && <div className="text-sm font-semibold text-[#D4AF37] italic">Sub: {q.subject}</div>}
                      <p className="text-sm text-gray-300 bg-[#0A0A0A]/55 p-3 border border-white/5 rounded italic">&ldquo;{q.message}&rdquo;</p>
                    </div>

                    <div className="flex md:flex-col items-stretch justify-end gap-2.5 min-w-[130px]">
                      {q.status !== "resolved" && (
                        <button 
                          onClick={() => handleResolveInquiry(q._id)}
                          className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-emerald-900/30 transition-colors flex items-center justify-center gap-1"
                          data-testid={`admin-resolve-inq-${q._id}`}
                        >
                          <Check className="h-3 w-3" /> Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteInquiry(q._id)}
                        className="bg-red-950/20 text-red-400 border border-red-900/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1"
                        data-testid={`admin-delete-inq-${q._id}`}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {adminTab === "reviews" && (
            <div className="space-y-6">
              {adminReviews.length === 0 ? (
                <div className="text-center p-12 border border-white/10 rounded bg-[#111]/40 text-gray-400">
                  <Star className="h-10 w-10 text-[#D4AF37] mx-auto mb-4 opacity-50" />
                  No reviews submitted yet.
                </div>
              ) : (
                adminReviews.map(r => (
                  <div key={r._id} className="border border-white/10 bg-[#111]/40 p-6 rounded relative flex flex-col md:flex-row justify-between gap-4 hover:border-[#D4AF37]/30 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-lg font-semibold text-white">{r.name}</h3>
                        <div className="flex text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-yellow-500" : "text-gray-600"}`} />
                          ))}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${r.approved ? "text-emerald-500 bg-emerald-950/20 border-emerald-900/30" : "text-gray-500 bg-gray-950/20 border-gray-900/30"}`}>
                          {r.approved ? "Approved / Visible" : "Pending Approval"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 italic">&ldquo;{r.comment}&rdquo;</p>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(r.created_at).toLocaleString()}</div>
                    </div>

                    <div className="flex md:flex-col items-stretch justify-end gap-2.5 min-w-[130px]">
                      <button 
                        onClick={() => handleToggleApproveReview(r._id)}
                        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors flex items-center justify-center gap-1 ${r.approved ? "bg-amber-950/20 text-amber-400 border-amber-900/30 hover:bg-amber-900/30" : "bg-emerald-950/20 text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/30"}`}
                        data-testid={`admin-approve-review-${r._id}`}
                      >
                        {r.approved ? "Hide" : "Approve"}
                      </button>
                      <button 
                        onClick={() => handleDeleteReviewAdmin(r._id)}
                        className="bg-red-950/20 text-red-400 border border-red-900/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1"
                        data-testid={`admin-delete-review-${r._id}`}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {adminTab === "edit-product" && (
            <div className="max-w-2xl mx-auto border border-white/10 bg-[#111]/40 p-8 rounded">
              <h2 className="font-serif text-2xl text-[#D4AF37] mb-6 font-medium border-b border-white/5 pb-3">
                {editingProduct ? `Edit Product: ${productForm.item}` : "Create New Product"}
              </h2>

              <form onSubmit={handleSaveProduct} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Product Name *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Special Kaju Katli"
                      value={productForm.item}
                      onChange={(e) => setProductForm({ ...productForm, item: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                      data-testid="admin-prod-form-item"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Category *</label>
                    <select 
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                      data-testid="admin-prod-form-category"
                    >
                      <option value="Khoya Items">Khoya Items</option>
                      <option value="Kaju & Dryfruit Sweets">Kaju & Dryfruit Sweets</option>
                      <option value="Ghee & Besan Items">Ghee & Besan Items</option>
                      <option value="Sugar Free Sweets">Sugar Free Sweets</option>
                      <option value="CHAAT">CHAAT (Snack)</option>
                      <option value="DESI DELIGHTS">DESI DELIGHTS (Snack)</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Bhaji">Bhaji</option>
                      <option value="Gifting">Gifting / Hampers</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 items-center bg-[#0A0A0A] p-4 rounded border border-white/5">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      id="is_sweet"
                      checked={productForm.is_sweet}
                      onChange={(e) => setProductForm({ ...productForm, is_sweet: e.target.checked })}
                      className="rounded border-white/10 bg-[#0A0A0A] text-[#D4AF37] focus:ring-0"
                    />
                    <label htmlFor="is_sweet" className="text-xs text-gray-300 font-semibold uppercase cursor-pointer">Is Sweet Category</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      id="is_featured"
                      checked={productForm.is_featured}
                      onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })}
                      className="rounded border-white/10 bg-[#0A0A0A] text-[#D4AF37] focus:ring-0"
                    />
                    <label htmlFor="is_featured" className="text-xs text-gray-300 font-semibold uppercase cursor-pointer">Feature on Homepage</label>
                  </div>
                </div>

                {productForm.is_sweet ? (
                  <div className="bg-[#0A0A0A]/50 p-4 border border-[#D4AF37]/10 rounded space-y-4">
                    <span className="text-[10px] tracking-[0.15em] uppercase text-[#D4AF37] font-bold">Sweet Price Tiers (₹)</span>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold">250g Price</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="₹"
                          value={productForm.price_250g}
                          onChange={(e) => setProductForm({ ...productForm, price_250g: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2 text-xs focus:border-[#D4AF37] outline-none text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold">500g Price</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="₹"
                          value={productForm.price_500g}
                          onChange={(e) => setProductForm({ ...productForm, price_500g: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2 text-xs focus:border-[#D4AF37] outline-none text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold">1Kg Base Price *</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required={productForm.is_sweet}
                          placeholder="₹"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value, price_1kg: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2 text-xs focus:border-[#D4AF37] outline-none text-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Unit Price *</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required={!productForm.is_sweet}
                        placeholder="e.g. 120"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Pricing Unit *</label>
                      <input 
                        type="text"
                        required={!productForm.is_sweet}
                        placeholder="e.g. Plate, Per Pc, Box"
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Image URL (Optional)</label>
                  <input 
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Product Description</label>
                  <textarea 
                    rows="3"
                    placeholder="Describe this delicious offering..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-sm focus:border-[#D4AF37] outline-none text-white"
                  />
                </div>

                <div className="flex items-center space-x-3 justify-end border-t border-white/5 pt-4">
                  <button 
                    type="button"
                    onClick={() => setAdminTab("products")}
                    className="border border-white/10 hover:bg-white/5 text-gray-300 font-semibold text-xs uppercase tracking-wider px-5 py-3 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={savingProduct}
                    className="bg-[#D4AF37] hover:bg-[#E5C865] text-[#0A0A0A] font-semibold text-xs uppercase tracking-wider px-6 py-3 disabled:opacity-50 transition-colors"
                    data-testid="admin-prod-form-submit"
                  >
                    {savingProduct ? "Saving..." : "Save Product"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      ) : (
        // PUBLIC FACING WEB EXPERIENCE
        <>
          {/* --- HERO BANNER --- */}
          <section className="relative min-h-[85vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden">
            {/* Background Image with Dark Golden Gradient Overlay */}
            <div className="absolute inset-0">
              <img 
                src="https://images.pexels.com/photos/8887196/pexels-photo-8887196.jpeg" 
                alt="Navnidhi Luxury Sweets Banner" 
                className="w-full h-full object-cover scale-105 filter brightness-[0.25]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent"></div>
            </div>

            {/* Hero Content */}
            <div className="relative max-w-5xl mx-auto px-6 text-center space-y-8 py-20">
              <div className="flex justify-center mb-2">
                <span className="text-[10px] sm:text-xs tracking-[0.3em] uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Traditional Indian Sweets & Snacks
                </span>
              </div>
              <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-wide leading-tight">
                Traditional Taste. <br />
                <span className="text-[#D4AF37] italic font-normal">Premium Experience.</span> <br />
                Made with <span className="underline decoration-[#D4AF37]/40 decoration-wavy underline-offset-8">Purity.</span>
              </h1>
              <p className="font-sans text-base sm:text-lg text-gray-300 max-w-2xl mx-auto tracking-wide leading-relaxed">
                Step into a world where premium quality meets honest pricing. Every recipe is crafted with pure desi ghee, organic ingredients, and absolute hygiene.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button 
                  onClick={() => scrollTo(catalogRef, "Sweets")}
                  className="w-full sm:w-auto bg-[#D4AF37] text-[#0A0A0A] font-semibold text-sm uppercase tracking-widest px-8 py-4 hover:bg-[#E5C865] hover:scale-[1.02] active:scale-95 transition-all duration-300"
                  data-testid="hero-primary-cta"
                >
                  Order Sweets Online
                </button>
                <button 
                  onClick={() => scrollTo(contactRef, "Contact")}
                  className="w-full sm:w-auto border border-[#D4AF37] text-[#D4AF37] bg-transparent font-semibold text-sm uppercase tracking-widest px-8 py-4 hover:bg-[#D4AF37]/10 hover:scale-[1.02] active:scale-95 transition-all duration-300"
                  data-testid="hero-secondary-cta"
                >
                  Visit Our Outlet
                </button>
              </div>
            </div>
          </section>

          {/* --- BRAND VALUE PROPOSITIONS --- */}
          <section className="py-20 border-t border-b border-[#D4AF37]/10 bg-[#111]/30">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                
                <div className="p-6 border border-white/5 bg-[#111]/45 hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white">Premium Quality</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">Finest, wholesome handpicked organic ingredients. Prepared fresh every single morning.</p>
                </div>

                <div className="p-6 border border-white/5 bg-[#111]/45 hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white">Hygienic Preparation</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">Prepared in a completely dust-free, state-of-the-art pure gold standard commercial kitchen.</p>
                </div>

                <div className="p-6 border border-white/5 bg-[#111]/45 hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                    <Award className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white">Authentic Desi Ghee</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">Never compromised. Everything is steeped in 100% pure premium grass-fed cow ghee.</p>
                </div>

                <div className="p-6 border border-white/5 bg-[#111]/45 hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white">Loved by Families</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">Trusted across generations. Perfect blend of rich heritage recipes and modern tastes.</p>
                </div>

              </div>
            </div>
          </section>

          {/* --- SIGNATURE COLLECTION (FEATURED ON HOMEPAGE) --- */}
          <section className="py-24 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center space-y-3 mb-16">
              <span className="text-[10px] tracking-[0.25em] uppercase text-[#D4AF37] font-bold">Chef&apos;s Recommendations</span>
              <h2 className="font-serif text-4xl sm:text-5xl font-medium tracking-wide">Signature Masterpieces</h2>
              <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mt-4"></div>
            </div>

            {loadingProducts ? (
              <div className="text-center py-20 text-gray-500">Loading signature collection...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.filter(p => p.is_featured).map(p => (
                  <div key={p._id} className="group border border-white/10 bg-[#111] hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col rounded overflow-hidden">
                    {/* Product Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-black">
                      <img 
                        src={p.image_url || "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=600&auto=format&fit=crop"} 
                        alt={p.item} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute top-3 right-3 bg-[#D4AF37] text-[#0A0A0A] font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded">
                        Best Seller
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <span className="text-[9px] tracking-widest uppercase text-gray-400 font-medium">{p.category}</span>
                        <h3 className="font-serif text-2xl text-[#D4AF37] font-semibold tracking-wide leading-none">{p.item}</h3>
                        <p className="text-xs text-gray-300 leading-relaxed italic">&ldquo;{p.description}&rdquo;</p>
                      </div>

                      {/* Sweet Weight Selector */}
                      {p.is_sweet ? (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 uppercase font-medium">Select Portion:</span>
                            <div className="flex gap-1.5">
                              {["250g", "500g", "1kg"].map(wt => (
                                <button 
                                  key={wt}
                                  onClick={() => setWeightChoices({ ...weightChoices, [p._id]: wt })}
                                  className={`px-2.5 py-1 text-[10px] font-bold border transition-colors ${weightChoices[p._id] === wt ? "bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]" : "border-white/10 hover:border-[#D4AF37] text-gray-300"}`}
                                >
                                  {wt}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className="text-xs text-gray-400 uppercase">Estimated Price:</span>
                            <span className="font-serif text-xl font-bold text-white">
                              ₹{weightChoices[p._id] === "250g" ? p.price_250g || (p.price / 4) : weightChoices[p._id] === "500g" ? p.price_500g || (p.price / 2) : p.price}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <span className="text-xs text-gray-400 uppercase">Price:</span>
                          <span className="font-serif text-xl font-bold text-white">₹{p.price} <span className="text-xs text-gray-500 font-sans font-normal">/ {p.unit}</span></span>
                        </div>
                      )}

                      {/* Action */}
                      <button 
                        onClick={() => addToCart(p)}
                        className="w-full bg-transparent hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#0A0A0A] border border-[#D4AF37] text-xs font-semibold uppercase tracking-widest py-3 transition-all duration-300"
                        data-testid={`add-to-cart-featured-${p._id}`}
                      >
                        Add to Order List
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* --- INTERACTIVE PRODUCT CATALOG --- */}
          <section ref={catalogRef} id="catalog" className="py-24 border-t border-[#D4AF37]/10 bg-[#111]/15 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="text-center space-y-3 mb-16">
                <span className="text-[10px] tracking-[0.25em] uppercase text-[#D4AF37] font-bold">Discover our catalog</span>
                <h2 className="font-serif text-4xl sm:text-5xl font-medium tracking-wide">The Complete Organic Menu</h2>
                <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mt-4"></div>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 mb-12">
                {/* Category Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-white/5 lg:border-none">
                  {["Sweets", "Snacks", "Gifting"].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setActiveTab("Sweets"); }}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-widest border transition-colors whitespace-nowrap ${selectedCategory === cat ? "bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]" : "border-white/10 hover:border-white/30 text-gray-400 hover:text-white"}`}
                      data-testid={`catalog-tab-${cat.toLowerCase()}`}
                    >
                      {cat} Menu
                    </button>
                  ))}
                </div>

                {/* Instant Search Bar */}
                <div className="relative min-w-[280px] md:min-w-[340px]">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder={`Search within ${selectedCategory}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded px-11 py-3 text-xs focus:border-[#D4AF37] outline-none text-white placeholder-gray-500"
                    data-testid="catalog-search-input"
                  />
                </div>
              </div>

              {/* Products Catalog Grid */}
              {loadingProducts ? (
                <div className="text-center py-20 text-gray-500">Loading catalog...</div>
              ) : publicFilteredProducts.length === 0 ? (
                <div className="text-center py-20 border border-white/5 rounded bg-[#111]/30 text-gray-400">
                  <Search className="h-8 w-8 text-[#D4AF37] mx-auto mb-3 opacity-50" />
                  No delicious products found matching your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {publicFilteredProducts.map(p => (
                    <div key={p._id} className="group border border-white/5 bg-[#111]/45 hover:border-[#D4AF37]/20 transition-all duration-300 flex flex-col justify-between rounded p-4 relative">
                      <div className="space-y-3">
                        {/* Image */}
                        <div className="aspect-[4/3] w-full overflow-hidden bg-black rounded">
                          <img 
                            src={p.image_url || "https://images.unsplash.com/photo-1772986236859-b16543cea543?q=80&w=600&auto=format&fit=crop"} 
                            alt={p.item} 
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                        {/* Title & Info */}
                        <div className="space-y-1">
                          <span className="text-[8px] tracking-wider uppercase text-gray-400">{p.category}</span>
                          <h3 className="font-serif text-lg font-semibold text-white group-hover:text-[#D4AF37] transition-colors duration-200 truncate">{p.item}</h3>
                          <p className="text-[11px] text-gray-400 line-clamp-1 italic">{p.description || "Crafted using premium organic ingredients."}</p>
                        </div>
                      </div>

                      {/* Sweet weight controls or standard unit pricing */}
                      <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
                        {p.is_sweet ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-400 uppercase font-semibold">Weight:</span>
                              <div className="flex gap-1">
                                {["250g", "500g", "1kg"].map(wt => (
                                  <button 
                                    key={wt}
                                    onClick={() => setWeightChoices({ ...weightChoices, [p._id]: wt })}
                                    className={`px-2 py-0.5 text-[9px] border transition-colors ${weightChoices[p._id] === wt ? "bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]" : "border-white/10 text-gray-300"}`}
                                  >
                                    {wt}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-500 uppercase">Subtotal:</span>
                              <span className="font-serif font-bold text-[#D4AF37]">
                                ₹{weightChoices[p._id] === "250g" ? p.price_250g || (p.price / 4) : weightChoices[p._id] === "500g" ? p.price_500g || (p.price / 2) : p.price}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 uppercase">Price:</span>
                            <span className="font-serif font-bold text-[#D4AF37]">₹{p.price} <span className="text-[10px] text-gray-500 font-sans">/{p.unit}</span></span>
                          </div>
                        )}

                        <button 
                          onClick={() => addToCart(p)}
                          className="w-full bg-[#111] hover:bg-[#D4AF37] text-gray-300 hover:text-[#0A0A0A] border border-white/10 hover:border-[#D4AF37] text-[10px] font-semibold uppercase tracking-widest py-2 transition-all duration-300"
                          data-testid={`add-to-cart-catalog-${p._id}`}
                        >
                          Add To List
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </section>

          {/* --- STORE EXPERIENCE & OUR STORY --- */}
          <section className="py-24 border-t border-[#D4AF37]/10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Side: Photography Bento Grid */}
              <div className="lg:col-span-6 grid grid-cols-12 gap-4">
                <div className="col-span-12 overflow-hidden aspect-[16/10] rounded border border-white/10 bg-black">
                  <img 
                    src="https://images.unsplash.com/photo-1748551204300-f227d5af350f" 
                    alt="Navnidhi Store Front" 
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="col-span-6 overflow-hidden aspect-square rounded border border-white/10 bg-black">
                  <img 
                    src="https://images.unsplash.com/photo-1595246007497-15e0ed4b8d96" 
                    alt="Premium sweets display cases" 
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="col-span-6 overflow-hidden aspect-square rounded border border-white/10 bg-black">
                  <img 
                    src="https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop" 
                    alt="Hygienic snack prep" 
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Right Side: Our Story Content */}
              <div className="lg:col-span-6 space-y-6">
                <span className="text-[10px] tracking-[0.25em] uppercase text-[#D4AF37] font-bold">Pure Tradition Since Inception</span>
                <h2 className="font-serif text-4xl sm:text-5xl font-medium tracking-wide">Navnidhi: Pure Desi Ghee Sweets Crafted with Pure Soul</h2>
                <div className="w-16 h-0.5 bg-[#D4AF37] mt-3"></div>
                
                <p className="text-sm text-gray-300 leading-relaxed">
                  Navnidhi Sweets is born from a simple yet powerful mission: to bring back the authentic, unadulterated tastes of traditional Indian sweets and savoury delights. Based in the heart of Dwarka, New Delhi, we prepare our sweets using only 100% pure desi ghee, premium organic dry fruits, and absolutely raw unrefined sugar options.
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Our state-of-the-art manufacturing kitchen adheres to uncompromising gold standard hygiene. No preservatives, no synthetic colors, and no artificial sweeteners. Our sweets are packed elegantly, serving as the perfect premium gift for your families, corporate circles, and wedding guest boxes.
                </p>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <span className="font-serif text-3xl font-bold text-[#D4AF37]">100%</span>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Pure Desi Ghee</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-serif text-3xl font-bold text-[#D4AF37]">Zero</span>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Added Colors / Preservatives</p>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* --- REVIEWS / TESTIMONIALS --- */}
          <section ref={reviewsRef} id="reviews" className="py-24 border-t border-[#D4AF37]/10 bg-[#111]/30 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="text-center space-y-3 mb-16">
                <span className="text-[10px] tracking-[0.25em] uppercase text-[#D4AF37] font-bold">Loved by Thousands</span>
                <h2 className="font-serif text-4xl sm:text-5xl font-medium tracking-wide">Customer Testimonials</h2>
                <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mt-4"></div>
              </div>

              {/* Reviews Grid Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                {reviews.map(r => (
                  <div key={r._id} className="p-6 border border-white/5 bg-[#111]/45 rounded flex flex-col justify-between space-y-4 hover:border-[#D4AF37]/20 transition-all duration-300">
                    <div className="space-y-2">
                      <div className="flex text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-500" : "text-gray-700"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed italic">&ldquo;{r.comment}&rdquo;</p>
                    </div>
                    <div>
                      <h4 className="font-serif font-semibold text-white leading-none">{r.name}</h4>
                      <span className="text-[9px] text-gray-500 tracking-wider">Verified Customer</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add a Review Form */}
              <div className="max-w-xl mx-auto border border-white/5 bg-[#111]/25 p-8 rounded hover:border-[#D4AF37]/10 transition-colors">
                <h3 className="font-serif text-2xl text-center text-[#D4AF37] font-semibold tracking-wide mb-6">Share Your Experience</h3>
                
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Name *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Anand Sharma"
                        value={newReview.name}
                        onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="review-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rating *</label>
                      <select 
                        value={newReview.rating}
                        onChange={(e) => setNewReview({ ...newReview, rating: parseInt(e.target.value) })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="review-rating"
                      >
                        <option value="5">5 Stars (Excellent)</option>
                        <option value="4">4 Stars (Very Good)</option>
                        <option value="3">3 Stars (Average)</option>
                        <option value="2">2 Stars (Poor)</option>
                        <option value="1">1 Star (Terrible)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Comments *</label>
                    <textarea 
                      required
                      rows="3"
                      placeholder="Write your honest comments about our sweets or customer service..."
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded p-2.5 text-xs text-white focus:border-[#D4AF37] outline-none"
                      data-testid="review-comment"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold text-xs uppercase tracking-widest py-3 hover:bg-[#E5C865] disabled:opacity-50 transition-all duration-300"
                    data-testid="review-submit-btn"
                  >
                    {submittingReview ? "Submitting..." : "Submit My Review"}
                  </button>
                </form>
              </div>

            </div>
          </section>

          {/* --- CONTACT US FORM & DETAILS --- */}
          <section ref={contactRef} id="contact" className="py-24 border-t border-[#D4AF37]/10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
              
              {/* Left Column: Direct details */}
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-3">
                  <span className="text-[10px] tracking-[0.25em] uppercase text-[#D4AF37] font-bold">Find Us / Get in touch</span>
                  <h2 className="font-serif text-4xl sm:text-5xl font-medium tracking-wide">Visit Our Sweets Outlet</h2>
                  <div className="w-16 h-0.5 bg-[#D4AF37] mt-3"></div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed">
                  Have a custom packaging request for weddings or corporate events? Need assistance placing a bulk festival order? Feel free to contact our support desk or visit our main outlet in Dwarka.
                </p>

                <div className="space-y-5 pt-4 text-sm text-gray-300">
                  
                  <div className="flex items-start space-x-3.5">
                    <MapPin className="h-5 w-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-white mb-0.5">Location</strong>
                      Dwarka, New Delhi - 110077
                    </div>
                  </div>

                  <div className="flex items-start space-x-3.5">
                    <Phone className="h-5 w-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-white mb-0.5">Call Support</strong>
                      +91 98765 43210
                    </div>
                  </div>

                  <div className="flex items-start space-x-3.5">
                    <Mail className="h-5 w-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-white mb-0.5">Email Support</strong>
                      info@navnidhisweets.com
                    </div>
                  </div>

                  <div className="flex items-start space-x-3.5">
                    <Clock className="h-5 w-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-white mb-0.5">Operating Hours</strong>
                      9:00 AM - 10:00 PM (All Days)
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Contact Inquiry Form */}
              <div className="lg:col-span-7 border border-white/5 bg-[#111]/15 p-8 rounded hover:border-[#D4AF37]/10 transition-colors">
                <h3 className="font-serif text-2xl text-[#D4AF37] font-semibold tracking-wide mb-6">Send an Inquiry Inquiry</h3>
                
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Name *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Name"
                        value={inquiry.name}
                        onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="inquiry-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Phone Number *</label>
                      <input 
                        type="tel"
                        required
                        placeholder="Phone"
                        value={inquiry.phone}
                        onChange={(e) => setInquiry({ ...inquiry, phone: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="inquiry-phone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email (Optional)</label>
                      <input 
                        type="email"
                        placeholder="Email address"
                        value={inquiry.email}
                        onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="inquiry-email"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Subject (Optional)</label>
                      <input 
                        type="text"
                        placeholder="e.g. Custom Corporate Gifting"
                        value={inquiry.subject}
                        onChange={(e) => setInquiry({ ...inquiry, subject: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                        data-testid="inquiry-subject"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Message *</label>
                    <textarea 
                      required
                      rows="4"
                      placeholder="Write your detailed request here..."
                      value={inquiry.message}
                      onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                      data-testid="inquiry-message"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={submittingInquiry}
                    className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold text-xs uppercase tracking-widest py-3.5 hover:bg-[#E5C865] disabled:opacity-50 transition-all duration-300"
                    data-testid="inquiry-submit-btn"
                  >
                    {submittingInquiry ? "Sending Inquiry..." : "Send Inquiry Request"}
                  </button>
                </form>
              </div>

            </div>
          </section>
        </>
      )}

      {/* --- REVEAL SECURE ADMIN LOGIN PANEL MODAL/TAB FALLBACK --- */}
      {activeTab === "Admin" && !user && adminCheckDone && (
        <div className="flex-grow flex items-center justify-center py-20 px-6">
          <div className="max-w-md w-full border border-white/10 bg-[#111] p-8 rounded space-y-6">
            <div className="text-center space-y-2">
              <Lock className="h-8 w-8 text-[#D4AF37] mx-auto mb-2" />
              <h2 className="font-serif text-2xl text-white font-semibold">Admin Secure Access</h2>
              <p className="text-xs text-gray-400">Enter administrator email and credentials to verify identity.</p>
            </div>

            {loginError && (
              <div className="bg-red-950/20 text-red-400 border border-red-900/30 p-3 rounded text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="admin@navnidhisweets.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                  data-testid="login-email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Password</label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded p-3 text-xs text-white focus:border-[#D4AF37] outline-none"
                  data-testid="login-password"
                />
              </div>

              <button 
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold text-xs uppercase tracking-widest py-3 hover:bg-[#E5C865] disabled:opacity-50 transition-all duration-300"
                data-testid="login-submit-btn"
              >
                {loginLoading ? "Verifying Credentials..." : "Authenticate Access"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- REALSIDE SLIDE-OVER CART DRAWER --- */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#111111] border-l border-[#D4AF37]/20 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#D4AF37]" />
                  <h2 className="font-serif text-2xl font-semibold tracking-wide text-white">Your Order List</h2>
                </div>
                <button 
                  onClick={() => setCartOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
                  aria-label="Close Cart"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-grow p-6 overflow-y-auto space-y-6">
                {cart.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 space-y-4">
                    <ShoppingBag className="h-12 w-12 text-[#D4AF37] mx-auto opacity-35" />
                    <p className="text-sm">Your order list is empty. Start adding delicious sweets!</p>
                    <button 
                      onClick={() => { setCartOpen(false); scrollTo(catalogRef, "Sweets"); }}
                      className="bg-transparent text-[#D4AF37] border border-[#D4AF37]/30 hover:border-[#D4AF37] px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      Start Exploring
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.cartItemId} className="flex items-center gap-4 bg-[#0A0A0A] p-3 rounded border border-white/5 hover:border-white/10 transition-colors">
                        <img 
                          src={item.image_url || "https://images.unsplash.com/photo-1772986236859-b16543cea543?q=80&w=600&auto=format&fit=crop"} 
                          alt={item.displayName} 
                          className="h-14 w-14 object-cover rounded bg-[#111]"
                        />
                        <div className="flex-grow min-w-0">
                          <h4 className="font-serif font-semibold text-sm text-white truncate">{item.item}</h4>
                          <span className="text-[10px] text-gray-400 block">{item.unit} Portion</span>
                          <span className="font-serif font-semibold text-xs text-[#D4AF37] mt-1 block">₹{item.price} each</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-2 border border-white/10 rounded bg-[#111] px-1">
                            <button 
                              onClick={() => updateCartQty(item.cartItemId, -1)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                              data-testid="cart-item-dec-btn"
                              aria-label="Decrease Quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQty(item.cartItemId, 1)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                              data-testid="cart-item-inc-btn"
                              aria-label="Increase Quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                            data-testid="cart-item-remove-btn"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-white/10 bg-[#0A0A0A]/60 space-y-4">
                  {/* Customer Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Your Name (Optional)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Anand Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-xs text-white focus:border-[#D4AF37] outline-none"
                    />
                  </div>

                  {/* Pricing Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 font-semibold uppercase">Total Value:</span>
                    <span className="font-serif text-2xl font-bold text-[#D4AF37]">₹{cartTotal}</span>
                  </div>
                  
                  <p className="text-[10px] text-gray-500 italic leading-relaxed text-center">Your order inquiry will be sent directly to our sweets outlet via WhatsApp.</p>

                  <button 
                    onClick={handleWhatsAppCheckout}
                    className="w-full bg-[#D4AF37] hover:bg-[#E5C865] text-[#0A0A0A] font-bold text-xs uppercase tracking-widest py-3.5 flex items-center justify-center gap-2 transition-all duration-300"
                    data-testid="whatsapp-checkout-btn"
                  >
                    <MessageSquare className="h-4 w-4" /> Order via WhatsApp
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer className="mt-auto border-t border-[#D4AF37]/10 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">
          
          {/* Brand Col */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center space-x-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_natural-sweets-store/artifacts/fvh7hzey_file_00000000b6e071fa838a7b01e5de191c.png" 
                alt="Navnidhi Logo" 
                className="h-10 w-10 border border-[#D4AF37]/20 rounded-full"
              />
              <span className="font-serif text-2xl tracking-wide text-[#D4AF37] font-semibold">NAVNIDHI</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              Navnidhi Sweets is dedicated to preserving traditional Indian sweets using pure organic ingredients and strict gold standard hygiene.
            </p>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] font-serif">शुद्धता हमारी पहचान</div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-serif text-lg text-white font-semibold tracking-wide">Quick Navigation</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <button onClick={() => scrollTo(null, "Home")} className="text-left hover:text-[#D4AF37] transition-colors">Home Page</button>
              <button onClick={() => scrollTo(catalogRef, "Sweets")} className="text-left hover:text-[#D4AF37] transition-colors">Our Sweets</button>
              <button onClick={() => scrollTo(reviewsRef, "Reviews")} className="text-left hover:text-[#D4AF37] transition-colors">Reviews</button>
              <button onClick={() => scrollTo(contactRef, "Contact")} className="text-left hover:text-[#D4AF37] transition-colors">Contact Us</button>
              {!user ? (
                <button onClick={() => setActiveTab("Admin")} className="text-left text-gray-500 hover:text-white transition-colors flex items-center gap-1"><Lock className="h-3 w-3" /> Secure Login</button>
              ) : (
                <button onClick={() => setActiveTab("Admin")} className="text-left text-[#E5C865] hover:text-white transition-colors flex items-center gap-1"><Sliders className="h-3 w-3" /> Dashboard</button>
              )}
            </div>
          </div>

          {/* Location / Details */}
          <div className="md:col-span-4 space-y-3 text-xs text-gray-400">
            <h4 className="font-serif text-lg text-white font-semibold tracking-wide">Navnidhi Outlet</h4>
            <div className="space-y-2">
              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#D4AF37]" /> Dwarka, New Delhi - 110077</p>
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#D4AF37]" /> +91 98765 43210</p>
              <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#D4AF37]" /> info@navnidhisweets.com</p>
            </div>
          </div>

        </div>

        {/* Sub-footer copyright */}
        <div className="border-t border-white/5 py-6">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 gap-4">
            <span>&copy; {new Date().getFullYear()} Navnidhi Sweets. All Rights Reserved.</span>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Use</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
