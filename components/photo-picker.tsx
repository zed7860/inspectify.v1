"use client";

import { useRef, useState } from "react";

export function PhotoPicker({ name = "photos", label = "Photos", required = true }: { name?: string; label?: string; required?: boolean }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const next = [...files, ...selected];
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (galleryRef.current) galleryRef.current.files = transfer.files;
    if (cameraRef.current) cameraRef.current.files = transfer.files;
  }

  function removeFile(index: number) {
    const next = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
  }

  return (
    <div className="photo-picker">
      <span className="photo-label">{label}</span>
      <input ref={galleryRef} name={name} type="file" accept="image/jpeg,image/png,image/webp" multiple required={required && files.length === 0} onChange={addFiles} />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple tabIndex={-1} aria-hidden="true" onChange={addFiles} />
      <div className="photo-picker-actions">
        <button type="button" className="photo-add" onClick={() => galleryRef.current?.click()}><strong>{files.length ? "Add from gallery" : "Choose from gallery"}</strong></button>
        <button type="button" className="photo-add" onClick={() => cameraRef.current?.click()}><strong>Use camera</strong></button>
      </div>
      {files.length > 0 && (
        <div className="photo-list">
          {files.map((file, index) => (
            <div className="photo-item" key={`${file.name}-${file.lastModified}-${index}`}>
              <span>{file.name}</span>
              <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button>
            </div>
          ))}
        </div>
      )}
      <p className="muted">JPEG, PNG or WebP; max 10 MB each.</p>
    </div>
  );
}