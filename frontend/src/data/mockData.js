// Mock Products Data
export const mockProducts = [
  {
    id: 1,
    name: "Spotless Face Wash",
    slug: "spotless-face-wash",
    price: 299,
    description: "Deep cleansing face wash for acne-prone and oily skin. Controls oil and reduces blemishes.",
    category: { id: 1, name: "Skincare", slug: "skincare" },
    sub_category: { id: 1, name: "Cleansers", slug: "cleansers" },
    image: "/images/products/product-0.jpg",
    image_main: "/images/products/product-0.jpg",
    image_2: "/images/products/product-0-alt.jpg",
    image_3: "/images/products/product-0-alt2.jpg",
    image_4: "/images/products/product-0-alt3.jpg",
    suitable_for: "Oily, Acne-prone",
    size: "100ml",
    sku: "LF-SW-001",
    rating: 4.5,
    reviews_count: 128,
    is_featured: true,
    is_bestseller: true,
    coming_soon: false,
    key_benefits: "Controls oil production, Deep pore cleansing, Reduces acne and blemishes, pH balanced formula",
    key_features: "Gentle surfactants, Non-drying, Soap-free formula, Dermatologically tested",
    ingredients: "Salicylic Acid, Tea Tree Oil, Niacinamide, Aloe Vera Extract, Glycerin",
    how_to_use: "Wet face, apply small amount, massage gently in circular motions, rinse thoroughly with water. Use twice daily.",
    stock: 50
  },
  {
    id: 2,
    name: "WhiteWave Face Wash",
    slug: "whitewave-face-wash",
    price: 349,
    description: "Soap-free brightening face wash that gently cleanses while promoting even skin tone.",
    category: { id: 1, name: "Skincare", slug: "skincare" },
    sub_category: { id: 1, name: "Cleansers", slug: "cleansers" },
    image: "/images/products/product-1.jpg",
    image_main: "/images/products/product-1.jpg",
    image_2: "/images/products/product-1-alt.jpg",
    image_3: "/images/products/product-1-alt2.jpg",
    image_4: "/images/products/product-1-alt3.jpg",
    suitable_for: "All Skin Types",
    size: "100ml",
    sku: "LF-WW-002",
    rating: 4.7,
    reviews_count: 95,
    is_featured: true,
    is_bestseller: false,
    coming_soon: false,
    key_benefits: "Brightens complexion, Reduces dark spots, Gentle cleansing, Maintains skin pH",
    key_features: "Soap-free formula, Vitamin C enriched, Hypoallergenic, Paraben-free",
    ingredients: "Vitamin C, Mulberry Extract, Licorice Extract, Kojic Acid, Glycerin",
    how_to_use: "Apply on damp face, massage for 30 seconds, rinse with lukewarm water. Use morning and night.",
    stock: 45
  }
];

// Mock Categories
export const mockCategories = [
  { id: 1, name: "Skincare", slug: "skincare" },
  { id: 2, name: "Haircare", slug: "haircare" },
  { id: 3, name: "Body Care", slug: "body-care" }
];

// Mock Sub-Categories
export const mockSubCategories = [
  { id: 1, name: "Cleansers", slug: "cleansers", category: 1 },
  { id: 2, name: "Brightening", slug: "brightening", category: 1 },
  { id: 3, name: "Moisturizers", slug: "moisturizers", category: 1 },
  { id: 4, name: "Sun Protection", slug: "sun-protection", category: 1 },
  { id: 5, name: "Hair Serums", slug: "hair-serums", category: 2 },
  { id: 6, name: "Shampoos", slug: "shampoos", category: 2 },
  { id: 7, name: "Body Wash", slug: "body-wash", category: 3 },
  { id: 8, name: "Lip Care", slug: "lip-care", category: 3 }
];

// Mock Reviews
export const mockReviews = {
  1: [
    {
      id: 1,
      rating: 5,
      comment: "Amazing face wash! Cleared my acne within 2 weeks. Highly recommend!",
      user: { id: 1, username: "Priya S." },
      created_at: "2024-10-15T10:30:00Z"
    },
    {
      id: 2,
      rating: 4,
      comment: "Good product but takes time to show results. Not drying at all.",
      user: { id: 2, username: "Rahul M." },
      created_at: "2024-10-10T14:20:00Z"
    }
  ],
  2: [
    {
      id: 3,
      rating: 5,
      comment: "My skin looks so much brighter! Love the gentle formula.",
      user: { id: 3, username: "Anjali K." },
      created_at: "2024-10-12T09:15:00Z"
    }
  ],
  3: [
    {
      id: 4,
      rating: 5,
      comment: "Best brightening cream I've ever used. Dark spots fading nicely!",
      user: { id: 4, username: "Sneha R." },
      created_at: "2024-10-18T16:45:00Z"
    }
  ],
  4: [
    {
      id: 5,
      rating: 5,
      comment: "My skin has never looked better! This serum is pure magic.",
      user: { id: 5, username: "Kavita P." },
      created_at: "2024-10-20T11:30:00Z"
    }
  ]
};

// Mock User
export const mockUser = {
  id: 1,
  username: "demo_user",
  email: "demo@lefoyer.com",
  first_name: "Demo",
  last_name: "User",
  phone_number: "+91-9876543210"
};

// Mock Testimonials
export const mockTestimonials = [
  {
    id: 1,
    name: "Priya Sharma",
    rating: 5,
    comment: "Le foyeR. products transformed my skin! The brightening serum is absolutely incredible.",
    location: "Mumbai"
  },
  {
    id: 2,
    name: "Rahul Verma",
    rating: 5,
    comment: "Best hair serum I've ever used. My hair feels so smooth and healthy now.",
    location: "Delhi"
  },
  {
    id: 3,
    name: "Anjali Patel",
    rating: 5,
    comment: "Love the natural ingredients and gentle formulations. Perfect for sensitive skin!",
    location: "Ahmedabad"
  }
];