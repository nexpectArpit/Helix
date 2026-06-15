"use client";

import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  name?: string; // Optional name for native form integration
  placeholder?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  disabled = false,
  name,
  placeholder = "Select an option",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value.toLowerCase() === value?.toLowerCase());

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {/* Hidden input for HTML form submissions */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Select Trigger Box */}
      <div
        className="input-field"
        onClick={handleToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          paddingRight: "0.85rem",
          borderColor: isOpen ? "var(--border-focus)" : "var(--border-color)",
          boxShadow: isOpen ? "0 0 0 3px rgba(95, 92, 230, 0.15)" : "none",
          userSelect: "none",
        }}
      >
        <span style={{ color: selectedOption ? "var(--text-primary)" : "var(--text-muted)" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        {/* Custom Chevron Arrow */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            pointerEvents: "none",
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Dropdown Options Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "rgba(18, 18, 24, 0.95)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "0.25rem",
            maxHeight: "250px",
            overflowY: "auto",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value.toLowerCase() === value?.toLowerCase();
            return (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                style={{
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isSelected ? "rgba(95, 92, 230, 0.2)" : "transparent",
                  fontWeight: isSelected ? 500 : 400,
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
