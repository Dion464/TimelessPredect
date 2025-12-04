import React, { useState, useEffect } from 'react';

const HowItWorksModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset to first step when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps = [
    {
      image: '/1.svg',
      number: '1',
      title: 'Pick a Market',
      description: "Buy 'Yes' or 'No' shares depending on your prediction. Buying shares is like betting on the outcome. Odds shift in real time as other trader's bet."
    },
    {
      image: '/2.svg',
      number: '2',
      title: 'Place a bet',
      description: "Fund your account with crypto, credit/debit card, or bank transfer, then you're ready to bet. No bet limits and no fees."
    },
    {
      image: '/3.svg',
      number: '3',
      title: 'Profit',
      description: "Sell your 'Yes' or 'No' shares at any time, or wait until the market ends to redeem winning shares for $1 each. Create an account and place your first trade in minutes."
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-[420px] mx-4 bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Image container */}
        <div className="relative w-full aspect-[4/3] bg-[#111] flex items-center justify-center overflow-hidden">
          <img 
            src={step.image} 
            alt={step.title}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Content */}
        <div className="p-6 pt-5">
          {/* Step indicator dots */}
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-[#FFE600] w-6' 
                    : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* Title */}
          <h2 className="text-white text-2xl font-bold text-center mb-3">
            {step.number}. {step.title}
          </h2>

          {/* Description */}
          <p className="text-[#A0A0A0] text-center text-[15px] leading-relaxed mb-6 min-h-[72px]">
            {step.description}
          </p>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex-1 py-3.5 px-6 rounded-xl border border-white/20 text-white font-semibold text-base hover:bg-white/5 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-xl bg-[#FFE600] text-black font-semibold text-base hover:bg-[#FFE600]/90 transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;

