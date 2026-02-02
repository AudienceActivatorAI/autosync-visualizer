"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import PreApprovalModal from "@/components/PreApprovalModal";
import { toast } from "sonner";
import { apiService } from "@/services/api";
import { launchFinancing } from "@/services/lendproService";

declare global {
  interface Window {
    Autosync?: any;
    autosyncInstance?: any;
  }
}

const AUTOSYNC_KEY = "RNR_2026";
const AUTOSYNC_CONTAINER_ID = "autosync-visualizer";

export default function AutosyncLanding() {
  const [ready, setReady] = useState(false);
  const [paymentSelectionOpen, setPaymentSelectionOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [preApprovalOpen, setPreApprovalOpen] = useState(false);
  const [launchURL, setLaunchURL] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'financing' | 'card' | null>(null);
  const initialized = useRef(false);
  const currentSelectionRef = useRef<any>(null); // Store current product selection

  // Show payment selection when BUY is clicked
  const handleBuyClick = useCallback(async () => {
    console.log("[Autosync] BUY clicked - showing payment selection");
    
    try {
      // Get current selection from Autosync
      let data = currentSelectionRef.current;
      
      // Try to get from Autosync instance if not in ref
      if (!data && window.autosyncInstance) {
        if (typeof window.autosyncInstance.getQuote === 'function') {
          data = window.autosyncInstance.getQuote();
        } else if (typeof window.autosyncInstance.getCurrentSelection === 'function') {
          data = window.autosyncInstance.getCurrentSelection();
        }
      }
      
      if (!data || (!data.wheels && !data.tires)) {
        toast.info('Please select products in the visualizer first');
        return;
      }
      
      // Show payment method selection
      setPaymentSelectionOpen(true);
    } catch (error) {
      console.error("[Autosync] Error handling BUY click:", error);
      toast.error('Please try selecting products first.');
    }
  }, []);

  // Launch financing after payment method is selected
  const launchFinancingWithSelection = useCallback(async () => {
    console.log("[Autosync] Launching financing with method:", paymentMethod);
    
    try {
      const data = currentSelectionRef.current;
      
      if (!data || (!data.wheels && !data.tires)) {
        toast.info('Please select products in the visualizer first');
        return;
      }
      
      // Calculate total from products
      let totalAmount = 0;
      const lineItems: any[] = [];
      
      // Process Tires
      if (data.tires && Array.isArray(data.tires)) {
        for (const tire of data.tires) {
          const price = await apiService.getProductPrice(tire.partNumber, 'tire');
          const quantity = tire.quantity || 4;
          totalAmount += price * quantity;
          
          lineItems.push({
            sku: tire.partNumber,
            description: `${tire.brand || ''} ${tire.model || tire.partNumber} - ${tire.width}/${tire.ratio}R${tire.diameter}`,
            quantity: quantity,
            unitPrice: price,
            totalPrice: price * quantity,
          });
        }
      }

      // Process Wheels
      if (data.wheels && Array.isArray(data.wheels)) {
        for (const wheel of data.wheels) {
          const price = await apiService.getProductPrice(wheel.partNumber, 'wheel');
          const quantity = wheel.quantity || 4;
          totalAmount += price * quantity;
          
          lineItems.push({
            sku: wheel.partNumber,
            description: `${wheel.brand || ''} ${wheel.model || wheel.partNumber} - ${wheel.diameter}x${wheel.width}`,
            quantity: quantity,
            unitPrice: price,
            totalPrice: price * quantity,
          });
        }
      }
      
      console.log('[Autosync] Calculated total:', totalAmount);
      console.log('[Autosync] Line items:', lineItems);
      
      if (paymentMethod === 'financing') {
        // Launch LendPro financing
        setIsSubmitting(true);
        setPaymentSelectionOpen(false);
        
        const result = await launchFinancing({
          orderId: `ORDER-${Date.now()}`,
          totalAmount: totalAmount,
          subtotal: totalAmount,
          tax: 0,
          fees: 0,
          shipping: 0,
          customer: {
            firstName: 'Guest',
            lastName: 'Customer',
            email: 'guest@customer.com',
            mobilePhone: '5555555555',
            streetAddress: '123 Main St',
            city: 'City',
            state: 'PA',
            zipCode: '12345',
          },
          items: lineItems.map(item => ({
            name: item.description,
            price: item.unitPrice,
            quantity: item.quantity,
          })),
        });
        
        setIsSubmitting(false);
        
        if (result.launchURL) {
          console.log('[Autosync] LendPro launch successful, opening lightbox');
          setLaunchURL(result.launchURL);
          setCheckoutOpen(true);
        } else {
          toast.error('Failed to launch financing');
        }
      } else if (paymentMethod === 'card') {
        // Show credit card payment form
        setPaymentSelectionOpen(false);
        toast.info('Credit card payment coming soon!');
        // TODO: Integrate credit card payment
      }
    } catch (error) {
      console.error("[Autosync] Error launching financing:", error);
      toast.error('Failed to launch financing. Please try again.');
      setIsSubmitting(false);
    }
  }, [paymentMethod]);

  // Handle DETAILS button click - show product details
  const handleDetailsClick = useCallback((e?: MouseEvent) => {
    console.log('[Autosync] DETAILS button clicked');
    
    // Try to get current product data
    try {
      if (window.autosyncInstance && typeof window.autosyncInstance.getCurrentProduct === 'function') {
        const product = window.autosyncInstance.getCurrentProduct();
        if (product) {
          toast.info(`Viewing details for ${product.brand || ''} ${product.model || ''}`);
          // Could open a details modal here
        }
      } else {
        toast.info('Product details are shown in the visualizer');
      }
    } catch (error) {
      console.error('[Autosync] Error handling DETAILS click:', error);
      toast.info('Product details are shown in the visualizer');
    }
  }, []);


  // Initialize the widget after the script loads
  const initAutosync = useCallback(() => {
    if (initialized.current) return;
    if (!window.Autosync) return;

    initialized.current = true;

    window.autosyncInstance = new window.Autosync({
      id: AUTOSYNC_CONTAINER_ID,
      key: AUTOSYNC_KEY,
      adaptiveHeight: false,
      disableQuoteForm: true, // Disable Autosync's form - we show LendPro directly
      homeStyle: null,
      productSegment: ['vehicles', 'wheels', 'tires'],
      scrollBar: false,
      startPage: null,
      widget: false,
      onEvent: function({ event, data }: { event: string, data: any }) {
        console.log('[Autosync] AutoSync Event:', event, data);
        console.log('[Autosync] API Key:', AUTOSYNC_KEY);
        console.log('[Autosync] Product Segment:', ['vehicles', 'wheels', 'tires']);
        
        // Store product selection data when products are selected
        if (data && (data.wheels || data.tires || data.vehicle)) {
          currentSelectionRef.current = data;
          console.log('[Autosync] Stored selection:', data);
          if (data.tires) {
            console.log('[Autosync] Tires found:', data.tires);
          } else {
            console.log('[Autosync] No tires in selection data');
          }
        }
        
        // When user submits quote OR clicks BUY, show payment selection
        if (event === 'submitQuote' || event === 'buy' || event === 'buyClick' || event === 'addToCart') {
          console.log('[Autosync] Quote/BUY event detected - showing payment selection');
          // Use the data from the event or stored selection
          if (data && (data.wheels || data.tires)) {
            currentSelectionRef.current = data;
          }
          handleBuyClick();
        }
      },
    });

    setReady(true);
  }, [handleBuyClick]);

  // Inject pre-approval button inside the visualizer
  const injectPreApprovalButton = useCallback(() => {
    const container = document.getElementById(AUTOSYNC_CONTAINER_ID);
    if (!container) return;

    // Check if button already exists
    if (container.querySelector('.autosync-preapproval-btn')) return;

    // Create button element
    const button = document.createElement('button');
    button.className = 'autosync-preapproval-btn';
    button.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 9999;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      transition: all 0.3s ease;
      cursor: pointer;
      background: linear-gradient(to bottom right, #dc2626, #b91c1c, #991b1b);
      border-radius: 0.5rem;
      padding: 12px 16px;
      border: 0;
      color: white;
      font-weight: bold;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: 180px;
    `;
    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 24px; height: 24px; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: bold; font-size: 14px;">AS</span>
        </div>
        <span style="font-size: 14px;">See if You Pre-Qualify</span>
      </div>
      <span style="font-size: 12px; color: rgba(255, 255, 255, 0.9); font-weight: normal;">
        Multiple Providers • Regardless of Credit
      </span>
    `;
    button.onmouseenter = () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 25px 50px -12px rgba(220, 38, 38, 0.5)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
    };
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPreApprovalOpen(true);
    };

    // Append to visualizer container
    container.appendChild(button);
    console.log('[Autosync] Pre-approval button injected successfully');
  }, [setPreApprovalOpen]);

  // Removed button interception - let Autosync work naturally
  // This function is now a no-op placeholder
  const interceptBuyDetailsButtons = useCallback(() => {
    console.log('[Autosync] Not intercepting buttons - letting Autosync work naturally');
    return; // Exit early - don't intercept
  }, []);

  // In case the script is already cached and available quickly:
  useEffect(() => {
    if (window.Autosync && !initialized.current) initAutosync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject pre-approval button when visualizer becomes ready
  useEffect(() => {
    if (ready) {
      console.log('[Autosync] Visualizer ready, injecting pre-approval button...');
      const timer1 = setTimeout(() => {
        console.log('[Autosync] Injecting pre-approval button (1s delay)');
        try {
          injectPreApprovalButton();
        } catch (error) {
          console.error('[Autosync] Error injecting pre-approval button:', error);
        }
      }, 1000);
      
      return () => {
        clearTimeout(timer1);
      };
    }
  }, [ready, injectPreApprovalButton]);


  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between px-5 py-3">
          <div className="flex items-center">
            <img 
              src="/autosync-logo.png" 
              alt="Autosync" 
              className="h-8 w-auto"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">
                Powered by
              </span>
              <img 
                src="/autosync-logo.png" 
                alt="Autosync" 
                className="h-4 w-auto"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero with Autosync Benefits */}
      <section className="mx-auto w-full px-5 py-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          THE VISUAL VEHICLE STUDIO IS BORN
        </h1>
        <p className="mt-2 text-sm md:text-base font-semibold text-gray-700">
          INDUSTRY EXPERIENCE - INTUITIVE DESIGN - BUILT "MOBILE 1ST" -COMPLETE VEHICLE UPGRADE SOLUTION
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Select your vehicle. Visualize. Checkout with flexible payment options.
        </p>
      </section>

      {/* Visualizer - Star of the Page - 100% Width */}
      <section id="start" className="w-full py-6">
        <div className="w-full p-4 relative">
          <div
            id={AUTOSYNC_CONTAINER_ID}
            className="min-h-[520px] w-full rounded-xl bg-gray-50 relative"
          />
        </div>

        {/* Autosync Script */}
        <Script
          src="https://vvs.autosyncstudio.com/js/Autosync.js"
          strategy="afterInteractive"
          onLoad={initAutosync}
          crossOrigin="anonymous"
        />

        {!ready && (
          <div className="mt-3 text-center text-sm text-gray-600">
            Loading visualizer…
          </div>
        )}
      </section>



      {/* Payment Method Selection Modal */}
      {paymentSelectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setPaymentSelectionOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Payment Method</h2>
            <p className="text-gray-600 mb-6 text-sm">Select how you&apos;d like to pay for your purchase</p>
            
            <div className="space-y-3">
              {/* LendPro Financing Option */}
              <button
                onClick={() => {
                  setPaymentMethod('financing');
                  launchFinancingWithSelection();
                }}
                className="w-full p-6 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-lg font-bold text-gray-900 mb-1">Lease-to-Own Financing</div>
                    <div className="text-sm text-gray-600">
                      Flexible payment options through LendPro. Instant decision, no credit impact to check.
                    </div>
                    <div className="mt-2 inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      RECOMMENDED
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Credit Card Option */}
              <button
                onClick={() => {
                  setPaymentMethod('card');
                  launchFinancingWithSelection();
                }}
                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-lg font-bold text-gray-900 mb-1">Credit Card</div>
                    <div className="text-sm text-gray-600">
                      Pay with your credit or debit card. Standard checkout process.
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LendPro Financing Lightbox - Mobile responsive */}
      {checkoutOpen && launchURL && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="fixed inset-0 sm:inset-4 md:inset-8 lg:inset-16 bg-white rounded-none sm:rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-red-600">
              <h2 className="text-lg sm:text-xl font-bold text-white">LendPro Financing</h2>
              <button
                onClick={() => {
                  setCheckoutOpen(false);
                  setLaunchURL(null);
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
            </div>
            
            {/* LendPro iframe - Mobile responsive */}
            <div className="flex-1 relative">
              <iframe
                src={launchURL}
                className="absolute inset-0 w-full h-full border-0"
                title="LendPro Financing Application"
                allow="payment"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Loading overlay during submission */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-gray-900">Launching financing...</p>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Approval Modal */}
      <PreApprovalModal
        isOpen={preApprovalOpen}
        onClose={() => setPreApprovalOpen(false)}
        estimatedAmount={5000}
      />
    </main>
  );
}

