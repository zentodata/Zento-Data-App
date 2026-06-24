// BASE DE DATOS DEFINITIVA - ZONAS ROJAS GUATEMALA
// Basada en ranking oficial de peligrosidad

const ZONAS_ROJAS=[
  // CIUDAD DE GUATEMALA - ZONA 1
  {zona:'Zona 1 - Centro',riesgo:7,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.640,lng:-90.503},
  {zona:'Zona 1 - Barrio Antiguo',riesgo:7,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.638,lng:-90.505},
  {zona:'Zona 1 - Parque Central',riesgo:7,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.640,lng:-90.508},
  
  // CIUDAD DE GUATEMALA - ZONA 2
  {zona:'Zona 2 - Sector Comercial',riesgo:6,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.648,lng:-90.495},
  
  // CIUDAD DE GUATEMALA - ZONA 3 (PELIGROSA)
  {zona:'Zona 3 - San Felipe',riesgo:9,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.630,lng:-90.507},
  {zona:'Zona 3 - Avenida Reforma',riesgo:9,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.628,lng:-90.505},
  {zona:'Zona 3 - Centro Civico',riesgo:9,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.635,lng:-90.510},
  
  // CIUDAD DE GUATEMALA - ZONA 4
  {zona:'Zona 4 - Zona Segura',riesgo:4,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.622,lng:-90.520},
  
  // CIUDAD DE GUATEMALA - ZONA 5
  {zona:'Zona 5 - Sector Residencial',riesgo:6,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.610,lng:-90.503},
  
  // CIUDAD DE GUATEMALA - ZONA 6 (PELIGROSA)
  {zona:'Zona 6 - Colonia La Florida',riesgo:8,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.628,lng:-90.590},
  {zona:'Zona 6 - La Montania',riesgo:8,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.633,lng:-90.592},
  
  // CIUDAD DE GUATEMALA - ZONA 7
  {zona:'Zona 7 - Barrio San Cristobal',riesgo:7,municipio:'Antigua Guatemala',departamento:'Sacatepequez',tipo:'zona',lat:14.550,lng:-90.730},
  
  // CIUDAD DE GUATEMALA - ZONA 8
  {zona:'Zona 8 - Zona Mixta',riesgo:7,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.600,lng:-90.520},
  
  // CIUDAD DE GUATEMALA - ZONA 9
  {zona:'Zona 9 - Sector Seguro',riesgo:4,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.600,lng:-90.490},
  
  // CIUDAD DE GUATEMALA - ZONA 10
  {zona:'Zona 10 - Zona Residencial',riesgo:3,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.590,lng:-90.490},
  
  // CIUDAD DE GUATEMALA - ZONA 11
  {zona:'Zona 11 - Barrio Arenales',riesgo:5,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.580,lng:-90.510},
  
  // CIUDAD DE GUATEMALA - ZONA 12
  {zona:'Zona 12 - Zona Intermedia',riesgo:6,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.570,lng:-90.490},
  
  // CIUDAD DE GUATEMALA - ZONA 13
  {zona:'Zona 13 - Zona Segura',riesgo:4,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.560,lng:-90.490},
  
  // CIUDAD DE GUATEMALA - ZONA 14
  {zona:'Zona 14 - Muy Segura',riesgo:2,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.585,lng:-90.485},
  
  // CIUDAD DE GUATEMALA - ZONA 15
  {zona:'Zona 15 - Muy Segura',riesgo:2,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.570,lng:-90.485},
  
  // CIUDAD DE GUATEMALA - ZONA 16
  {zona:'Zona 16 - Segura',riesgo:4,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.560,lng:-90.503},
  
  // CIUDAD DE GUATEMALA - ZONA 17 (PELIGROSA)
  {zona:'Zona 17 - Zona Roja',riesgo:8,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.550,lng:-90.495},
  
  // CIUDAD DE GUATEMALA - ZONA 18 (MAS PELIGROSA)
  {zona:'Zona 18 - Villa Nueva',riesgo:10,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.450,lng:-90.570},
  {zona:'Zona 18 - El Limon',riesgo:10,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.455,lng:-90.575},
  {zona:'Zona 18 - Colonia San Cristobal',riesgo:10,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.445,lng:-90.565},
  
  // CIUDAD DE GUATEMALA - ZONA 21 (PELIGROSA)
  {zona:'Zona 21 - Sector Problematico',riesgo:8,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.630,lng:-90.465},
  
  // CIUDAD DE GUATEMALA - ZONA 24
  {zona:'Zona 24 - Zona Intermedia',riesgo:6,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.600,lng:-90.478},
  
  // CIUDAD DE GUATEMALA - ZONA 25 (PELIGROSA)
  {zona:'Zona 25 - Sector Problematico',riesgo:8,municipio:'Guatemala',departamento:'Guatemala',tipo:'zona',lat:14.590,lng:-90.473},
  
  // ===== MIXCO - MUNICIPIO COMPLETO =====
  {zona:'Mixco - Centro Municipal',riesgo:5,municipio:'Mixco',departamento:'Guatemala',tipo:'municipio',lat:14.628,lng:-90.590},
  {zona:'Mixco - Zona 1',riesgo:5,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.628,lng:-90.590},
  {zona:'Mixco - Zona 2 Las Brisas',riesgo:6,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.630,lng:-90.585},
  {zona:'Mixco - Zona 3',riesgo:7,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.632,lng:-90.595},
  {zona:'Mixco - Zona 4',riesgo:7,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.625,lng:-90.600},
  {zona:'Mixco - Zona 5',riesgo:8,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.620,lng:-90.598},
  {zona:'Mixco - Zona 6',riesgo:6,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.635,lng:-90.605},
  {zona:'Mixco - Zona 7',riesgo:5,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.640,lng:-90.580},
  {zona:'Mixco - Zona 8 San Cristobal',riesgo:3,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.650,lng:-90.610},
  {zona:'Mixco - Zona 10',riesgo:7,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.625,lng:-90.588},
  {zona:'Mixco - Zona 11',riesgo:6,municipio:'Mixco',departamento:'Guatemala',tipo:'zona',lat:14.635,lng:-90.592},
  {zona:'Mixco - El Milagro',riesgo:9,municipio:'Mixco',departamento:'Guatemala',tipo:'aldea',lat:14.645,lng:-90.615},
  {zona:'Mixco - La Comunidad',riesgo:8,municipio:'Mixco',departamento:'Guatemala',tipo:'aldea',lat:14.650,lng:-90.605},
  {zona:'Mixco - Lo de Bran',riesgo:8,municipio:'Mixco',departamento:'Guatemala',tipo:'aldea',lat:14.655,lng:-90.600},
  {zona:'Mixco - Bosques de San Nicolas',riesgo:6,municipio:'Mixco',departamento:'Guatemala',tipo:'aldea',lat:14.660,lng:-90.620},
  
  // ===== VILLA NUEVA - MUNICIPIO COMPLETO =====
  {zona:'Villa Nueva - Centro Municipal',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'municipio',lat:14.450,lng:-90.570},
  {zona:'Villa Nueva - Zona 1',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.450,lng:-90.570},
  {zona:'Villa Nueva - Zona 2',riesgo:6,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.455,lng:-90.575},
  {zona:'Villa Nueva - Zona 3',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.445,lng:-90.565},
  {zona:'Villa Nueva - Zona 4',riesgo:8,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.448,lng:-90.578},
  {zona:'Villa Nueva - Zona 5',riesgo:8,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.442,lng:-90.568},
  {zona:'Villa Nueva - Zona 6',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'zona',lat:14.460,lng:-90.572},
  {zona:'Villa Nueva - Villa Hermosa I',riesgo:8,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.440,lng:-90.580},
  {zona:'Villa Nueva - Villa Hermosa II',riesgo:9,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.435,lng:-90.575},
  {zona:'Villa Nueva - San Jose Villa Nueva',riesgo:8,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.445,lng:-90.560},
  {zona:'Villa Nueva - El Bucaro',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.450,lng:-90.555},
  {zona:'Villa Nueva - Linda Vista',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.455,lng:-90.585},
  {zona:'Villa Nueva - Barcena',riesgo:8,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.425,lng:-90.565},
  {zona:'Villa Nueva - Ciudad Real',riesgo:6,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.460,lng:-90.590},
  {zona:'Villa Nueva - Reformita',riesgo:7,municipio:'Villa Nueva',departamento:'Guatemala',tipo:'aldea',lat:14.415,lng:-90.575},
  
  // ===== SAN MIGUEL PETAPA - MUNICIPIO COMPLETO =====
  {zona:'San Miguel Petapa - Centro Municipal',riesgo:6,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'municipio',lat:14.380,lng:-90.540},
  {zona:'San Miguel Petapa - Centro',riesgo:6,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'zona',lat:14.380,lng:-90.540},
  {zona:'San Miguel Petapa - Villa Hermosa',riesgo:8,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'aldea',lat:14.385,lng:-90.542},
  {zona:'San Miguel Petapa - Prados de Villa Hermosa',riesgo:7,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'aldea',lat:14.382,lng:-90.545},
  {zona:'San Miguel Petapa - Los Alamos',riesgo:6,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'aldea',lat:14.378,lng:-90.538},
  {zona:'San Miguel Petapa - San Antonio',riesgo:7,municipio:'San Miguel Petapa',departamento:'Guatemala',tipo:'aldea',lat:14.375,lng:-90.535},
  
  // ===== VILLA CANALES - MUNICIPIO COMPLETO =====
  {zona:'Villa Canales - Centro Municipal',riesgo:5,municipio:'Villa Canales',departamento:'Guatemala',tipo:'municipio',lat:14.320,lng:-90.530},
  {zona:'Villa Canales - Centro',riesgo:5,municipio:'Villa Canales',departamento:'Guatemala',tipo:'zona',lat:14.320,lng:-90.530},
  {zona:'Villa Canales - Boca del Monte',riesgo:6,municipio:'Villa Canales',departamento:'Guatemala',tipo:'aldea',lat:14.325,lng:-90.535},
  {zona:'Villa Canales - Santa Elena Barillas',riesgo:5,municipio:'Villa Canales',departamento:'Guatemala',tipo:'aldea',lat:14.315,lng:-90.545},
  {zona:'Villa Canales - El Tablon',riesgo:6,municipio:'Villa Canales',departamento:'Guatemala',tipo:'aldea',lat:14.310,lng:-90.540},
  {zona:'Villa Canales - San Jose Veraminas',riesgo:5,municipio:'Villa Canales',departamento:'Guatemala',tipo:'aldea',lat:14.330,lng:-90.520},
  {zona:'Villa Canales - Colmenas',riesgo:7,municipio:'Villa Canales',departamento:'Guatemala',tipo:'aldea',lat:14.305,lng:-90.535},
];

function evaluarZonaRoja(direccion){
  if(!direccion||direccion.trim()==='')return null;
  
  const dirMin=direccion.toLowerCase();
  
  for(let zona of ZONAS_ROJAS){
    if(dirMin.includes(zona.zona.toLowerCase())||
       dirMin.includes(zona.municipio.toLowerCase())||
       dirMin.includes(zona.departamento.toLowerCase())){
      return{
        encontrada:zona.riesgo>=6,
        zona:zona.zona,
        riesgo:zona.riesgo,
        municipio:zona.municipio,
        departamento:zona.departamento,
        tipo:zona.tipo,
        mensaje:zona.riesgo>=6?`ZONA ROJA: ${zona.zona} - ${zona.municipio} (Riesgo ${zona.riesgo}/10)`:`Zona verificada: ${zona.zona} - ${zona.municipio} (Riesgo ${zona.riesgo}/10)`
      };
    }
  }
  
  return{encontrada:false,mensaje:'Zona verificada (aparentemente segura)'};
}
