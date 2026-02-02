import { useState } from 'react';

export const useBarcodeScanner = () => {
  const [barcode, setBarcode] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [image, setImage] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);

  const detectBarcodeFromImage = (imageSrc: string): Promise<string> => {
    setIsDetecting(true);
    setError('');
    
    return new Promise((resolve) => {
      console.log('🎯 Configuration IDENTIQUE à PrestaShop...');
      
      if (!(window as any).Quagga) {
        console.error('❌ Quagga pas chargé!');
        setIsDetecting(false);
        resolve('');
        return;
      }
      
      const Quagga = (window as any).Quagga;
      
      // CONFIGURATION IDENTIQUE À CE QUI MARCHAIT
      Quagga.decodeSingle({
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader', 
            'upc_reader',
            'code_128_reader',
            'code_39_reader'
          ]
        },
        locate: true,
        src: imageSrc,
        numOfWorkers: 0,
        inputStream: {
          size: 800,
          type: 'ImageStream',
          src: imageSrc
        },
        patchSize: 'medium',
        halfSample: true,
        debug: {
          drawBoundingBox: false,
          showFrequency: false,
          drawScanline: false,
          showPattern: false
        }
      }, (result: any) => {
        console.log('📊 Résultat Quagga:', result);
        
        if (result && result.codeResult) {
          console.log('✅ Code-barre détecté!', result.codeResult.code);
          setIsDetecting(false);
          resolve(result.codeResult.code);
        } else {
          console.log('❌ Pas de détection - Essai méthode 2');
          // Méthode de secours
          setTimeout(() => {
            tryAlternativeMethod(imageSrc).then((altResult) => {
              setIsDetecting(false);
              resolve(altResult);
            });
          }, 100);
        }
      });
    });
  };

  const tryAlternativeMethod = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      console.log('🔄 Méthode alternative plus simple...');
      
      const Quagga = (window as any).Quagga;
      
      if (!Quagga) {
        resolve('');
        return;
      }
      
      // Configuration ultra simple
      Quagga.decodeSingle({
        src: imageSrc,
        numOfWorkers: 0,
        decoder: {
          readers: ['ean_reader']
        }
      }, (result: any) => {
        if (result && result.codeResult) {
          console.log('✅ Détecté avec méthode simple!', result.codeResult.code);
          resolve(result.codeResult.code);
        } else {
          console.log('❌ Échec total');
          resolve('');
        }
      });
    });
  };

  const startScanning = () => {
    setIsScanning(true);
    setError('');
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const captureImage = (imageData: string) => {
    setImage(imageData);
  };

  const scanImage = async (imageData: string): Promise<boolean> => {
    console.log('🔍 Scan en cours...');
    
    const detectedBarcode = await detectBarcodeFromImage(imageData);
    
    if (detectedBarcode) {
      console.log('🎉 Succès! Code-barre:', detectedBarcode);
      setBarcode(detectedBarcode);
      setError('');
      return true;
    } else {
      // Demander manuellement comme fallback
      const manualBarcode = prompt(
        "Le scan automatique a échoué.\n\n" +
        "Entrez le code-barre manuellement :\n" +
        "(Laissez vide pour ignorer)"
      );
      
      if (manualBarcode !== null && manualBarcode.trim()) {
        setBarcode(manualBarcode.trim());
        setError('');
        return true;
      }
      
      setError('Aucun code-barre détecté. Essayez manuellement.');
      return false;
    }
  };

  return {
    barcode,
    setBarcode,
    isScanning,
    isDetecting,
    startScanning,
    stopScanning,
    captureImage,
    image,
    setImage,
    error,
    scanImage,
  };
};