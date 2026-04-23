/**
 * BarcodeScanner
 *
 * Uses the device camera via @zxing/browser to scan product barcodes (UPC/EAN).
 * On successful scan → calls Open Food Facts for product info →
 * returns { itemName, category, calories, protein, carbs, fat } to the caller.
 *
 * Usage:
 *   <BarcodeScanner
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onScanned={(item) => addItem(item)}
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScannedProduct {
  barcode: string;
  itemName: string;
  brand: string;
  category: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (product: ScannedProduct) => void;
}

async function lookupBarcode(barcode: string): Promise<ScannedProduct> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'Replate-Nutrition/1.0 (jtctechsoft@gmail.com)' } }
    );
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();
    const p = data.product;

    if (!p) throw new Error('Product not found');

    const itemName =
      p.product_name_en || p.product_name || p.abbreviated_product_name || `Product ${barcode}`;
    const brand = p.brands?.split(',')[0]?.trim() || '';
    const category = p.food_groups_tags?.[0]
      ?.replace('en:', '')
      ?.replace(/-/g, ' ')
      ?.replace(/\b\w/g, (c: string) => c.toUpperCase()) ||
      p.categories?.split(',')[0]?.trim() || 'Other';

    const n = p.nutriments || {};
    return {
      barcode,
      itemName: brand ? `${brand} ${itemName}` : itemName,
      brand,
      category,
      calories: n['energy-kcal_100g'] ? Math.round(n['energy-kcal_100g']) : null,
      protein: n['proteins_100g'] ? Math.round(n['proteins_100g'] * 10) / 10 : null,
      carbs: n['carbohydrates_100g'] ? Math.round(n['carbohydrates_100g'] * 10) / 10 : null,
      fat: n['fat_100g'] ? Math.round(n['fat_100g'] * 10) / 10 : null,
    };
  } catch {
    return {
      barcode,
      itemName: `Product ${barcode}`,
      brand: '',
      category: 'Other',
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    };
  }
}

export function BarcodeScanner({ open, onClose, onScanned }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'loading' | 'found' | 'error'>('idle');
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
      scannedRef.current = false;
      setStatus('idle');
      setScannedProduct(null);
      setErrorMsg('');
      return;
    }

    let cancelled = false;

    async function startScan() {
      setStatus('scanning');
      try {
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          async (result, err) => {
            if (cancelled || scannedRef.current) return;
            if (err) return; // NotFoundException or decode error
            if (!result) return;

            scannedRef.current = true;
            controls.stop();
            setStatus('loading');

            const barcode = result.getText();
            const product = await lookupBarcode(barcode);
            if (!cancelled) {
              setScannedProduct(product);
              setStatus('found');
            }
          }
        );

        if (!cancelled) controlsRef.current = controls;
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message?.includes('Permission') || err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser settings.'
            : 'Could not access camera. Please check your device settings.');
          setStatus('error');
        }
      }
    }

    startScan();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [open]);

  const handleConfirm = () => {
    if (scannedProduct) {
      onScanned(scannedProduct);
      onClose();
    }
  };

  const handleRetry = () => {
    scannedRef.current = false;
    setScannedProduct(null);
    setStatus('idle');
    // Re-trigger by toggling open state handled by parent, or restart manually
    controlsRef.current?.stop();
    setTimeout(() => {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      reader.decodeFromVideoDevice(undefined, videoRef.current!, async (result, err) => {
        if (scannedRef.current) return;
        if (err) return; // includes NotFoundException
        if (!result) return;
        scannedRef.current = true;
        setStatus('loading');
        const product = await lookupBarcode(result.getText());
        setScannedProduct(product);
        setStatus('found');
      }).then((c) => { controlsRef.current = c; });
      setStatus('scanning');
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <DialogTitle>Scan Barcode</DialogTitle>
          </div>
        </DialogHeader>

        {/* Camera viewfinder */}
        <div className="relative bg-black aspect-[4/3] w-full overflow-hidden">
          <video
            ref={videoRef}
            className={cn(
              'w-full h-full object-cover',
              (status === 'found' || status === 'loading') && 'opacity-30'
            )}
            playsInline
            muted
          />

          {/* Scanning overlay */}
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-48 h-32 border-2 border-white/70 rounded-xl">
                {/* Corner decorations */}
                <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                {/* Scanning line */}
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-medium drop-shadow">
                Point camera at barcode
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 rounded-2xl px-6 py-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Looking up product…</span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="bg-white/95 rounded-2xl p-5 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                <p className="text-sm font-medium">{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>

        {/* Result panel */}
        {status === 'found' && scannedProduct && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 shrink-0 mt-0.5">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{scannedProduct.itemName}</p>
                <p className="text-xs text-muted">{scannedProduct.category}</p>
                {(scannedProduct.calories || scannedProduct.protein || scannedProduct.carbs) && (
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
                    {scannedProduct.calories && <span>{scannedProduct.calories} kcal</span>}
                    {scannedProduct.protein && <span>P: {scannedProduct.protein}g</span>}
                    {scannedProduct.carbs && <span>C: {scannedProduct.carbs}g</span>}
                    {scannedProduct.fat && <span>F: {scannedProduct.fat}g</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleRetry}>
                Scan Again
              </Button>
              <Button size="sm" className="flex-1" onClick={handleConfirm}>
                Add to List
              </Button>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'scanning') && (
          <div className="px-5 py-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
