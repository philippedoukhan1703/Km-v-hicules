import React from 'react';

interface VehiclePlateProps {
  immatriculation: string;
  size?: 'sm' | 'md' | 'lg';
  departement?: string;
  regionLogo?: string;
}

export const VehiclePlate: React.FC<VehiclePlateProps> = ({
  immatriculation,
  size = 'md',
  departement = '83',
}) => {
  const sizeClasses = {
    sm: 'text-xs sm:text-sm px-2 py-0.5 h-7 min-w-[118px] border-2 tracking-wider',
    md: 'text-base px-2.5 py-1 h-9 min-w-[150px] border-2 tracking-widest font-black',
    lg: 'text-xl px-3.5 py-1.5 h-11 min-w-[195px] border-2 tracking-widest font-black',
  }[size];

  const flagSize = {
    sm: 'text-[9px] sm:text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-between font-mono font-bold bg-white text-slate-950 border-slate-800 rounded-md shadow-xs select-none ${sizeClasses}`}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      title={`Plaque d'immatriculation ${immatriculation}`}
    >
      {/* Bandeau gauche UE / F */}
      <div className="flex flex-col items-center justify-center bg-[#003399] text-white px-1.5 -my-1 self-stretch rounded-l-xs">
        <span className="text-yellow-300 leading-none text-[8px] sm:text-[9px]">★</span>
        <span className={`${flagSize} font-bold leading-none`}>F</span>
      </div>

      {/* Numéro d'immatriculation */}
      <div className="px-2.5 font-black tracking-wider text-slate-950 uppercase whitespace-nowrap">
        {immatriculation}
      </div>

      {/* Bandeau droit Département Var (83) / PACA */}
      <div className="flex flex-col items-center justify-center bg-[#003399] text-white px-1.5 -my-1 self-stretch rounded-r-xs">
        <span className="text-[7px] sm:text-[8px] text-sky-200 leading-none font-semibold">RTE</span>
        <span className={`${flagSize} font-bold leading-none`}>{departement}</span>
      </div>
    </div>
  );
};
