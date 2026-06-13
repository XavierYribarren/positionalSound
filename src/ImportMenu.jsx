import React, { useState, useRef } from 'react';
import './css/ImportMenu.css'
export default function ImportMenu({
  onAdd,
  onAutoAssign,      // new prop
  disabled = false,
}) {
  const [files, setFiles] = useState([]);
  const fileInputRef     = useRef();

  function handleFileChange(e) {
    setFiles(Array.from(e.target.files || []));
  }

  function makeItems() {
    return files.map(file => {
      const url  = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '');
      return { file, url, name };
    });
  }

  function clear() {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }

  function handleAdd() {
    if (!files.length) return;
    onAdd(makeItems());
    clear();
  }

  function handleAuto() {
    if (!files.length || !onAutoAssign) return;
    onAutoAssign(makeItems());
    clear();
  }

  return (
    <div className="import-menu" style={{ margin: '1em 0' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        disabled={disabled}
        onChange={handleFileChange}
        className="file-input-hidden"
      />
      <button
        className="file-select-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
      >
        {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Choose files'}
      </button>
      <div className="import-buttons">

      <button
        onClick={handleAdd}
        disabled={disabled || files.length === 0}
        style={{ marginLeft: '0.5em' }}
        >
        Add {files.length} Track{files.length > 1 ? 's' : ''}
      </button>
      {/* {onAutoAssign && ( */}
        <button
          onClick={handleAuto}
          disabled={disabled || files.length === 0}
          style={{ marginLeft: '0.5em' }}
          >
          Auto Assign
        </button>
      {/* )} */}
          </div>
    </div>
  );
}
