"use client";

import { useRef, useState } from "react";

export function PhotoPicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const next = [...files, ...selected];
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function removeFile(index: number) {
    const next = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  return (
    <div className="photo-picker">
      <input ref={inputRef} name="photos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple required={files.length === 0} onChange={addFiles} />
      <button type="button" className="photo-add" onClick={() => inputRef.current?.click()} aria-label="Add another photo">
        <span aria-hidden="true">+</span>
        <strong>{files.length ? "Add more photos" : "Add photos"}</strong>
      </button>
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