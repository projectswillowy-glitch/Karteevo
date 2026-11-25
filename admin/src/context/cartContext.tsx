'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getLocalCart } from '@/lib/local-cart';

interface CartWishlistContextType {
  cartCount: number;
  wishlistCount: number;
  updateCartCount: () => Promise<void>;
  updateWishlistCount: () => Promise<void>;
}

const CartWishlistContext = createContext<CartWishlistContextType | undefined>(undefined);

export function CartWishlistProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  // The admin panel has no storefront cart or wishlist. The customer-only
  // /cart and /wishlist endpoints reject admin sessions with 401, so counts
  // are kept local instead of calling them.
  const updateCartCount = async () => {
    try {
      const localCart = getLocalCart();
      const totalItems = localCart.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalItems);
    } catch (error) {
      console.error("Failed to load cart", error);
    }
  };

  const updateWishlistCount = async () => {
    setWishlistCount(0);
  };


  useEffect(() => {
    updateCartCount();
    updateWishlistCount();
  }, []);

  return (
    <CartWishlistContext.Provider value={{ 
      cartCount, 
      wishlistCount, 
      updateCartCount, 
      updateWishlistCount,
    }}>
      {children}
    </CartWishlistContext.Provider>
  );
}

export const useCartWishlist = () => {
  const context = useContext(CartWishlistContext);
  if (context === undefined) {
    throw new Error('useCartWishlist must be used within a CartWishlistProvider');
  }
  return context;
};

// Optional: Keep the old hook names for backwards compatibility
export const useCart = () => {
  const { cartCount, updateCartCount } = useCartWishlist();
  return { cartCount, updateCartCount };
};

export const useWishlist = () => {
  const { wishlistCount, updateWishlistCount } = useCartWishlist();
  return { wishlistCount, updateWishlistCount };
};
