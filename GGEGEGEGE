"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProductMetadata = {
  success: boolean;
  title?: string;
  price?: string;
  images?: string[];
  favicon?: string;
  usedFavicon?: boolean;
  productUrl?: string;
  error?: string;
};

export default function AddGiftForm({
  wishlistId,
}: {
  wishlistId: string;
}) {
  const router = useRouter();

  const [productUrl, setProductUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [instructions, setInstructions] = useState("");

  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [usedFavicon, setUsedFavicon] = useState(false);

  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productMessage, setProductMessage] = useState("");
  const [error, setError] = useState("");

  async function getProduct() {
    if (!productUrl.trim()) {
      setError("Paste a product link first.");
      return;
    }

    setLoadingProduct(true);
    setError("");
    setProductMessage("");
    setImages([]);
    setSelectedImage("");
    setUsedFavicon(false);

    try {
      const response = await fetch("/api/product-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: productUrl.trim(),
        }),
      });

      const data: ProductMetadata = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "We could not get the product information from this link."
        );
        setLoadingProduct(false);
        return;
      }

      if (data.productUrl) {
        setProductUrl(data.productUrl);
      }

      if (data.title) {
        setName(data.title);
      }

      if (data.price) {
        const cleanedPrice = String(data.price).replace(
          /[^0-9.]/g,
          ""
        );

        if (cleanedPrice) {
          setPrice(cleanedPrice);
        }
      }

      const foundImages = Array.isArray(data.images)
        ? data.images.filter(Boolean)
        : [];

      setImages(foundImages);
      setUsedFavicon(Boolean(data.usedFavicon));

      if (foundImages.length > 0) {
        setSelectedImage(foundImages[0]);

        if (data.usedFavicon) {
          setProductMessage(
            "We could not find a product photo, so we found the store logo instead."
          );
        } else if (foundImages.length === 1) {
          setProductMessage("We found 1 product image.");
        } else {
          setProductMessage(
            `We found ${foundImages.length} images. Choose the one you want to use.`
          );
        }
      } else {
        setProductMessage(
          "We could not find an image automatically. You can add an image link below."
        );
      }
    } catch {
      setError(
        "Something went wrong while getting the product information."
      );
    } finally {
      setLoadingProduct(false);
    }
  }

  function useManualImage() {
    const value = manualImageUrl.trim();

    if (!value) {
      setError("Enter an image link first.");
      return;
    }

    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    let normalizedImageUrl = "";

    try {
      const parsed = new URL(withProtocol);

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {
        throw new Error();
      }

      normalizedImageUrl = parsed.toString();
    } catch {
      setError("Enter a valid image link.");
      return;
    }

    setError("");
    setManualImageUrl(normalizedImageUrl);

    setImages((current) => {
      if (current.includes(normalizedImageUrl)) {
        return current;
      }

      return [normalizedImageUrl, ...current];
    });

    setSelectedImage(normalizedImageUrl);
    setUsedFavicon(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!productUrl.trim()) {
      setError("Enter the store link for this gift.");
      return;
    }

    if (!name.trim()) {
      setError("Enter a name for this gift.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/gifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wishlistId,
          productUrl: productUrl.trim(),
          name: name.trim(),
          imageUrl: selectedImage.trim(),
          price: price.trim(),
          description: description.trim(),
          shippingAddress: shippingAddress.trim(),
          instructions: instructions.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not add this gift.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/wishlist/${wishlistId}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "20px",
        padding: "30px",
        boxShadow: "0 15px 40px rgba(0,0,0,0.06)",
      }}
    >
      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Gift Link
      </label>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "8px",
        }}
      >
        <input
          type="text"
          inputMode="url"
          value={productUrl}
          onChange={(event) => {
            setProductUrl(event.target.value);
            setError("");
            setProductMessage("");
          }}
          placeholder="Paste a link from Amazon or another store"
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            border: "1px solid #d1d5db",
            borderRadius: "11px",
            padding: "14px 16px",
            fontSize: "16px",
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={getProduct}
          disabled={loadingProduct}
          style={{
            background: "#111827",
            color: "#ffffff",
            border: "none",
            borderRadius: "11px",
            padding: "0 20px",
            fontSize: "14px",
            fontWeight: "800",
            cursor: loadingProduct ? "not-allowed" : "pointer",
            opacity: loadingProduct ? 0.65 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loadingProduct ? "Getting..." : "Get Product"}
        </button>
      </div>

      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
          lineHeight: "1.5",
          marginBottom: "24px",
        }}
      >
        Paste the product page and we&apos;ll try to find the
        name, price, and photos for you.
      </div>

      {productMessage && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            borderRadius: "11px",
            padding: "12px 14px",
            fontSize: "13px",
            fontWeight: "700",
            lineHeight: "1.5",
            marginBottom: "20px",
          }}
        >
          {productMessage}
        </div>
      )}

      {images.length > 0 && (
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "800",
              marginBottom: "6px",
            }}
          >
            Choose Gift Image
          </div>

          <div
            style={{
              color: "#6b7280",
              fontSize: "13px",
              marginBottom: "14px",
              lineHeight: "1.5",
            }}
          >
            {usedFavicon
              ? "No product photos were available, so the store logo will be used."
              : "Choose the photo that looks best on your wishlist."}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(105px, 1fr))",
              gap: "12px",
            }}
          >
            {images.map((image, index) => {
              const selected = selectedImage === image;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedImage(image);
                    setError("");
                  }}
                  style={{
                    position: "relative",
                    background: "#ffffff",
                    height: "120px",
                    padding: "7px",
                    borderRadius: "13px",
                    border: selected
                      ? "3px solid #2563eb"
                      : "1px solid #d1d5db",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  <img
                loading="lazy"
                decoding="async"
                    src={image}
                    alt={`Product option ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />

                  {selected && (
                    <span
                      style={{
                        position: "absolute",
                        right: "6px",
                        bottom: "6px",
                        background: "#2563eb",
                        color: "#ffffff",
                        borderRadius: "999px",
                        padding: "4px 8px",
                        fontSize: "10px",
                        fontWeight: "800",
                      }}
                    >
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "800",
            marginBottom: "8px",
          }}
        >
          Add Your Own Image
        </label>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            type="text"
            inputMode="url"
            value={manualImageUrl}
            onChange={(event) =>
              setManualImageUrl(event.target.value)
            }
            placeholder="https://..."
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: "border-box",
              border: "1px solid #d1d5db",
              borderRadius: "11px",
              padding: "14px 16px",
              fontSize: "16px",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={useManualImage}
            style={{
              background: "#ffffff",
              color: "#2563eb",
              border: "1px solid #2563eb",
              borderRadius: "11px",
              padding: "0 18px",
              fontSize: "14px",
              fontWeight: "800",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Use Image
          </button>
        </div>
      </div>

      {selectedImage && (
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "800",
              marginBottom: "10px",
            }}
          >
            Selected Image
          </div>

          <div
            style={{
              width: "100%",
              height: "300px",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={selectedImage}
              alt="Selected gift"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}

      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Gift Name
      </label>

      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError("");
        }}
        placeholder="Gift name"
        maxLength={120}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: "11px",
          padding: "14px 16px",
          fontSize: "16px",
          outline: "none",
          marginBottom: "24px",
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Price
      </label>

      <div
        style={{
          position: "relative",
          marginBottom: "24px",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#6b7280",
            fontWeight: "700",
          }}
        >
          $
        </span>

        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="49.99"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #d1d5db",
            borderRadius: "11px",
            padding: "14px 16px 14px 34px",
            fontSize: "16px",
            outline: "none",
          }}
        />
      </div>

      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Description
      </label>

      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Tell people a little about this gift."
        maxLength={1000}
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: "11px",
          padding: "14px 16px",
          fontSize: "16px",
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          marginBottom: "24px",
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Shipping Address
      </label>

      <textarea
        value={shippingAddress}
        onChange={(event) =>
          setShippingAddress(event.target.value)
        }
        placeholder="Enter the address where this gift should be shipped."
        maxLength={500}
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: "11px",
          padding: "14px 16px",
          fontSize: "16px",
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          marginBottom: "8px",
        }}
      />

      <div
        style={{
          color: "#6b7280",
          fontSize: "12px",
          lineHeight: "1.5",
          marginBottom: "24px",
        }}
      >
        Only shown to the person who reserves this gift.
      </div>

      <label
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: "800",
          marginBottom: "8px",
        }}
      >
        Instructions
      </label>

      <textarea
        value={instructions}
        onChange={(event) =>
          setInstructions(event.target.value)
        }
        placeholder="Example: Please choose the large size."
        maxLength={1000}
        rows={4}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: "11px",
          padding: "14px 16px",
          fontSize: "16px",
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          marginBottom: error ? "12px" : "24px",
        }}
      />

      {error && (
        <div
          style={{
            color: "#dc2626",
            fontSize: "14px",
            fontWeight: "700",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          background: "#2563eb",
          color: "#ffffff",
          border: "none",
          borderRadius: "11px",
          padding: "15px 18px",
          fontSize: "16px",
          fontWeight: "800",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Adding Gift..." : "Add Gift"}
      </button>
    </form>
  );
}
