/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parsePersonalCsv } from '../utils/personalParser';
import { PersonalRegistro } from '../types/personal';

export const RAW_SAMPLE_PERSONAL_MERINOS = `Fecha;id;EMPRESAS;Frente;ACTIVIDAD;Hd;Md;Hn;Mn;H;M;Total
17-ago-26;1;ACCIONA;Campamento de oficinas;Supervision ;2;;;;2;0;2
17-ago-26;2;ACCIONA AGUA;Campamento de oficinas;Pasante;5;;;;5;0;5
17-ago-26;3;ACCIONA AGUA;Campamento de Oficinas y Campo;Tecnico Administrativo;34;21;;;34;21;55
17-ago-26;4;ACCIONA AGUA;Bodega;Bodeguero;2;;;;2;0;2
17-ago-26;5;ACCIONA AGUA;Calle 5;Mediciones de Topografia;2;;;;2;0;2
17-ago-26;6;ACCIONA AGUA;Campo;Tecnico electrico ;2;;;;2;0;2
17-ago-26;7;ACERSERV;Edificio De Espesadores;Tecnico Administrativo;1;1;;;1;1;2
17-ago-26;8;ACERSERV;Edificio De Espesadores;Soldadura;4;;;;4;0;4
17-ago-26;9;ADECO;Campamento de oficinas;Tecnico Administrativo;3;;;;3;0;3
17-ago-26;10;ADECO;Edificio De Administracion y Operaciones;Impermeabilizacion;5;;;;5;0;5
17-ago-26;11;CAMILA SALAZAR;Campamento de oficinas;Contract Manager;;1;;;0;1;1
17-ago-26;12;CDECONS;Campamento de Oficinas y Campo;Tecnico Administrativo;4;2;;;4;2;6
17-ago-26;13;CDECONS;Campo;Apoyo;10;;;;10;0;10
17-ago-26;14;CDECONS;Cuadrante 13;Elaboracion de separadores de hormigon;1;;;;1;0;1
17-ago-26;15;CDECONS;Laboratorio Holcim;Apoyo;1;;;;1;0;1
17-ago-26;16;CDECONS;Campo;Izaje de cargas;2;;;;2;0;2
17-ago-26;17;CDECONS;Campo;Verificacion en campo (capataces);3;;;;3;0;3
17-ago-26;18;CDECONS;Bodega;Bodeguero;2;;;;2;0;2
17-ago-26;19;CDECONS;Edificio de Cogeneradores;Albañiles;2;;;;2;0;2
17-ago-26;20;CDECONS;Edificio de Digestores, SubE N3-CCM8;Albañiles;3;;;;3;0;3
17-ago-26;21;CDECONS;Edificio de Hipoclorito de Sodio, SubE N2-CCM4;Albañiles;6;;;;6;0;6
17-ago-26;22;CDECONS;Cajas y sumideros;Albañiles;8;;;;8;0;8
17-ago-26;23;CDECONS;Cerramiento Autopista Narcisa de Jesus;Albañiles;6;;;;6;;6
17-ago-26;24;CDECONS;Cadica 2;Albañiles;0;;;;0;;0
17-ago-26;25;CDECONS;Edificio De Administracion y Operaciones;Albañiles;8;;;;8;0;8
17-ago-26;26;CDECONS;Puente vehicular;Carpinteros;2;;;;2;0;2
17-ago-26;27;CDECONS;Estacion de bombeo 2;Albañiles;6;;;;6;0;6
17-ago-26;28;CIPORT;Campamento de Oficinas y Campo;Tecnico Administrativo;2;;;;2;0;2
17-ago-26;29;CIPORT;Ptar Biologica;Hinca de tablestacas;8;;;;8;0;8
17-ago-26;30;CODEMET;Campamento de oficinas;Tecnico Administrativo;1;1;;;1;1;2
17-ago-26;31;CODEMET;Estructura De Entrada - Pretratamiento;Montaje de bomba ;6;;;;6;0;6
17-ago-26;32;CONRAYO;Campo;Servicio Medico;1;1;;;1;1;2
17-ago-26;33;CONSTRICOM;Campamento de oficinas;Tecnico Administrativo;2;1;;;2;1;3
17-ago-26;34;CONSTRICOM;Edificio de Digestores, SubE N3-CCM8;Obra civil;5;;;;5;0;5
17-ago-26;35;CONSTRICOM;Edificio De Administracion y Operaciones;Mamposteria;3;;;;3;0;3
17-ago-26;36;CONSTRULADESA;Campo;Estudios de suelos;1;;;;1;0;1
17-ago-26;37;EECOL;Campamento de Oficinas y Campo;Tecnico Administrativo;3;1;;;3;1;4
17-ago-26;38;EECOL;Edificio de Generadores De Energia CCM13, Subestacion N4;Instalacion electrica;4;;;;4;0;4
17-ago-26;39;EECOL;Edificio de Sopladores N2-CCM7;Instalacion electrica;4;;;;4;0;4
17-ago-26;40;EECOL;Estructura De Entrada - Pretratamiento;Instalacion electrica;4;;;;4;0;4
17-ago-26;41;EKON ;Calle 5;Instalacion de tuberias;12;;;;12;0;12
17-ago-26;42;EKON ;Campo;Apoyo;2;;;;2;;2
17-ago-26;43;EKON ;Calle 5;Tecnico Administrativo;2;2;;;2;2;4
17-ago-26;44;FIBRADOR;Clarificador 1;Tecnico Administrativo;2;;;;2;0;2
17-ago-26;45;FIBRADOR;Clarificador 2;Instalacion de soporte;4;;;;4;0;4
17-ago-26;46;FISCALIZACION;Campamento de Oficinas y Campo;Tecnico administrativo;34;10;;;34;10;44
17-ago-26;47;GRUAS HORMIGA NEGRA;Campo;Tecnico administrativo;1;;;;1;0;1
17-ago-26;48;GRUAS HORMIGA NEGRA;Edificio de Digestores, SubE N3-CCM8;Izaje de cargas;2;;;;2;0;2
17-ago-26;49;GRUAS HORMIGA NEGRA;Estacion de bombeo 2;Izaje de cargas;2;;;;2;0;2
17-ago-26;50;GRUAS HORMIGA NEGRA;Campo;Mecanica;1;;;;1;0;1
17-ago-26;51;GRUAS HORMIGA NEGRA;Campo;Izaje de cargas;2;;;;2;0;2
17-ago-26;52;GRUAS HORMIGA NEGRA;Campo;Elevacion y manipulacion de materiales;2;;;;2;;2
17-ago-26;53;GRUAS HORMIGA NEGRA;Campo;Elevador de persona ;2;;;;2;0;2
17-ago-26;54;GRUAS HORMIGA NEGRA;Estructura de medida;Izaje de cargas;2;;;;2;0;2
17-ago-26;55;HOLCIM;Campo;Hormigonado;2;;;;2;0;2
17-ago-26;56;INTEC;Digestor N2;Soldadura;2;;;;2;0;2
17-ago-26;57;INTEC;Campamento de Oficinas y Campo;Tecnico Administrativo;2;1;;;2;1;3
17-ago-26;58;INTEC;Edificio De Almacen (Taller);Montaje de accesorios;3;;;;3;0;3
17-ago-26;59;JUANA VALLEJO;Campamento de Oficinas y Campo;Tecnico Administrativo;2;2;;;2;2;4
17-ago-26;60;JUANA VALLEJO;Edificio De Deshidratacion-CCM12;Adoquinado de vias internas;5;;;;5;0;5
17-ago-26;61;JUANA VALLEJO;Edificio De Administracion y Operaciones;Obra civil;3;;;;3;0;3
17-ago-26;62;JUANA VALLEJO;Edificio De Personal y Servicios;Adoquinado de vias internas;1;;;;1;0;1
17-ago-26;63;JUANA VALLEJO;Calle 5;Adoquinado de vias internas;11;;;;11;0;11
17-ago-26;64;KRANEC;Campo;Instalacion de protecciones colectivas;2;;;;2;0;2
17-ago-26;65;KUBIEC;Campo;Alquiler de encofrados;1;;;;1;0;1
17-ago-26;66;LICOSA;Campamento de oficinas;Campamento de oficinas;3;1;;;3;1;4
17-ago-26;67;LICOSA;Campo;Mediciones de Topografia;2;;;;2;0;2
17-ago-26;68;LICOSA;Cuadrante 14;Excavacion;3;;;;3;0;3
17-ago-26;69;LICOSA;Cuadrante 10;Relleno con grava;2;;;;2;0;2
17-ago-26;70;LICOSA;Calle 5;Tendido de material;2;;;;2;0;2
17-ago-26;71;LICOSA;Cuadrante 17;Compactacion ;2;;;;2;0;2
17-ago-26;72;LICOSA;Taller mecanico;Mecanica;1;;;;1;0;1
17-ago-26;73;LICOSA;Campo;Transporte externo de material;1;;;;1;0;1
17-ago-26;74;LICOSA;Campo;Transporte interno material ;4;;;;4;0;4
17-ago-26;75;METALCO;Cuadrante 20;Tecnico Administrativo;2;;;;2;;2
17-ago-26;76;METALCO;Cuadrante 20;Soldadura;12;;;;12;0;12
17-ago-26;77;MINDUSTRIAL;Edificio De Deshidratacion-CCM12;Tecnico Administrativo;3;;;;3;0;3
17-ago-26;78;MINDUSTRIAL;Edificio De Deshidratacion-CCM12;Montaje de bomba ;4;;;;4;0;4
17-ago-26;79;MOSS SECURITY;Puerta Sur;Vigilancia;2;;2;;4;0;4
17-ago-26;80;MOSS SECURITY;Puerta Norte;Vigilancia;2;;2;;4;0;4
17-ago-26;81;MOSS SECURITY;Cerramiento Interagua;Vigilancia;1;;;;1;0;1
17-ago-26;82;RICSON;Campamento de Oficinas y Campo;Tecnico Administrativo;1;2;;;1;2;3
17-ago-26;83;RICSON;Cuadrante 2, 12. 13, 15;Instalacion de tuberias;9;;;;9;0;9
17-ago-26;84;RICSON;Bodega;Bodeguero;1;;;;1;0;1
17-ago-26;85;"SCHUMACHER ECOMAG";Campamento de oficinas;Limpieza;2;;;;2;0;2
17-ago-26;86;SERP;E.B Cloruro Ferrico;Instalacion de tuberias electricas;3;;;;3;0;3
17-ago-26;87;SERP;Campamento de oficinas;Tecnico Administrativo;4;;;;4;0;4
17-ago-26;88;SERP;Edificio de Hipoclorito de Sodio, SubE N2-CCM4;Instalacion de tuberias electricas;3;;;;3;;3
17-ago-26;89;SERP;Clarificador 1;Instalacion de tuberias electricas;4;;;;4;0;4
17-ago-26;90;SERP;Calle 8;Instalacion de tuberias electricas;5;;;;5;0;5
17-ago-26;91;SIGMAN ;Edificio de Digestores, SubE N3-CCM8;Tecnico Administrativo;2;;;;2;0;2
17-ago-26;92;SIGMAN ;Edificio De Administracion y Operaciones;Instalacion de ductos;8;;;;8;;8
17-ago-26;93;SMAT ISP;Campamento de oficinas;Soporte IT;1;;;;1;0;1
17-ago-26;94;TECNIUM;Campo;Supervision montaje;4;;;;4;0;4
17-ago-26;95;TOPOCERO;Estacion de Bombeo del Afluente;Mediciones de Topografia;2;;;;2;0;2
17-ago-26;96;TOPOCERO;Puente vehicular;Mediciones de Topografia;2;;;;2;0;2
18-ago-26;1;ACCIONA;Campamento de oficinas;Supervision ;2;;;;2;0;2
18-ago-26;2;ACCIONA AGUA;Campamento de oficinas;Pasante;5;;;;5;0;5
18-ago-26;3;ACCIONA AGUA;Campamento de Oficinas y Campo;Tecnico Administrativo;34;22;;;34;22;56
18-ago-26;4;ACCIONA AGUA;Bodega;Bodeguero;2;;;;2;0;2
18-ago-26;5;ACCIONA AGUA;Calle 5;Mediciones de Topografia;2;;;;2;0;2
18-ago-26;6;ACCIONA AGUA;Campo;Tecnico electrico ;2;;;;2;0;2
18-ago-26;7;ACERSERV;Edificio De Espesadores;Tecnico Administrativo;1;1;;;1;1;2
18-ago-26;8;ACERSERV;Edificio De Espesadores;Soldadura;4;;;;4;0;4
18-ago-26;9;ADECO;Campamento de oficinas;Tecnico Administrativo;3;;;;3;0;3
18-ago-26;10;ADECO;Edificio De Administracion y Operaciones;Impermeabilizacion;5;;;;5;0;5
18-ago-26;11;CAMILA SALAZAR;Campamento de oficinas;Contract Manager;;1;;;0;1;1
18-ago-26;12;CDECONS;Campamento de Oficinas y Campo;Tecnico Administrativo;3;2;;;3;2;5
18-ago-26;13;CDECONS;Campo;Apoyo;6;;;;6;0;6
18-ago-26;14;CDECONS;Cuadrante 13;Elaboracion de separadores de hormigon;1;;;;1;0;1
18-ago-26;15;CDECONS;Laboratorio Holcim;Apoyo;1;;;;1;0;1
18-ago-26;16;CDECONS;Campo;Izaje de cargas;2;;;;2;0;2
18-ago-26;17;CDECONS;Campo;Verificacion en campo (capataces);2;;;;2;0;2
18-ago-26;18;CDECONS;Bodega;Bodeguero;2;;;;2;0;2
18-ago-26;19;CDECONS;Edificio de Generadores De Energia CCM13, Subestacion N4;Albañiles;2;;;;2;0;2
18-ago-26;20;CDECONS;Edificio de Digestores, SubE N3-CCM8;Albañiles;3;;;;3;0;3
18-ago-26;21;CDECONS;Edificio de Hipoclorito de Sodio, SubE N2-CCM4;Albañiles;6;;;;6;0;6
18-ago-26;22;CDECONS;Cajas y sumideros;Albañiles;8;;;;8;0;8
18-ago-26;23;CDECONS;Cerramiento Autopista Narcisa de Jesus;Albañiles;6;;;;6;;6
18-ago-26;24;CDECONS;Estacion de bombeo 2;Albañiles;6;;;;6;;6
18-ago-26;25;CDECONS;Edificio De Administracion y Operaciones;Albañiles;8;;;;8;0;8
18-ago-26;26;CDECONS;Puente vehicular;Carpinteros;2;;;;2;0;2
18-ago-26;27;CDECONS;Cuadrante 20;Albañiles;6;;;;6;0;6
18-ago-26;28;CIPORT;Campamento de Oficinas y Campo;Tecnico Administrativo;2;;;;2;0;2
18-ago-26;29;CIPORT;Ptar Biologica;Hinca de tablestacas;8;;;;8;0;8
18-ago-26;30;CODEMET;Campamento de oficinas;Tecnico Administrativo;1;1;;;1;1;2
18-ago-26;31;CODEMET;Estructura De Entrada - Pretratamiento;Montaje de bomba ;6;;;;6;0;6
18-ago-26;32;CONRAYO;Campo;Servicio Medico;1;1;;;1;1;2
18-ago-26;33;CONSTRICOM;Campamento de oficinas;Tecnico Administrativo;2;1;;;2;1;3
18-ago-26;34;CONSTRICOM;Edificio de Digestores, SubE N3-CCM8;Obra civil;5;;;;5;0;5
18-ago-26;35;CONSTRICOM;Edificio De Administracion y Operaciones;Mamposteria;3;;;;3;0;3
18-ago-26;36;CONSTRULADESA;Campo;Estudios de suelos;1;;;;1;0;1
18-ago-26;37;EECOL;Campamento de Oficinas y Campo;Tecnico Administrativo;3;1;;;3;1;4
18-ago-26;38;EECOL;Edificio de Generadores De Energia CCM13, Subestacion N4;Instalacion electrica;4;;;;4;0;4
18-ago-26;39;EECOL;Edificio de Sopladores N2-CCM7;Instalacion electrica;4;;;;4;0;4
18-ago-26;40;EECOL;Estructura De Entrada - Pretratamiento;Instalacion electrica;4;;;;4;0;4
18-ago-26;41;EKON ;Calle 5;Instalacion de tuberias;12;;;;12;0;12
18-ago-26;42;EKON ;Campo;Apoyo;2;;;;2;;2
18-ago-26;43;EKON ;Calle 5;Tecnico Administrativo;2;2;;;2;2;4
18-ago-26;44;FIBRADOR;Clarificador 1;Tecnico Administrativo;2;;;;2;0;2
18-ago-26;45;FIBRADOR;Clarificador 2;Instalacion de soporte;4;;;;4;0;4
18-ago-26;46;FISCALIZACION;Campamento de Oficinas y Campo;Tecnico administrativo;34;10;;;34;10;44
18-ago-26;47;GRUAS HORMIGA NEGRA;Campo;Tecnico administrativo;1;;;;1;0;1
18-ago-26;48;GRUAS HORMIGA NEGRA;Edificio de Digestores, SubE N3-CCM8;Izaje de cargas;2;;;;2;0;2
18-ago-26;49;GRUAS HORMIGA NEGRA;Almacenamiento De Lodos Digeridos N1;Izaje de cargas;2;;;;2;0;2
18-ago-26;50;GRUAS HORMIGA NEGRA;Campo;Mecanica;1;;;;1;0;1
18-ago-26;51;GRUAS HORMIGA NEGRA;Campo;Izaje de cargas;2;;;;2;0;2
18-ago-26;52;GRUAS HORMIGA NEGRA;Campo;Elevacion y manipulacion de materiales;2;;;;2;;2
18-ago-26;53;GRUAS HORMIGA NEGRA;Campo;Elevador de persona ;2;;;;2;0;2
18-ago-26;54;GRUAS HORMIGA NEGRA;Estructura De Entrada - Pretratamiento;Izaje de cargas;2;;;;2;0;2
18-ago-26;55;HOLCIM;Campo;Hormigonado;2;;;;2;0;2
18-ago-26;56;INTEC;Digestor N2;Soldadura;4;;;;4;0;4
18-ago-26;57;INTEC;Campamento de Oficinas y Campo;Tecnico Administrativo;2;1;;;2;1;3
18-ago-26;58;INTEC;Almacenamiento De Lodos Digeridos N1;Montaje de accesorios;2;;;;2;0;2
18-ago-26;59;JUANA VALLEJO;Campamento de Oficinas y Campo;Tecnico Administrativo;2;2;;;2;2;4
18-ago-26;60;JUANA VALLEJO;Edificio De Deshidratacion-CCM12;Adoquinado de vias internas;2;;;;2;0;2
18-ago-26;61;JUANA VALLEJO;Edificio De Administracion y Operaciones;Obra civil;7;;;;7;0;7
18-ago-26;62;JUANA VALLEJO;Edificio De Personal y Servicios;Adoquinado de vias internas;2;;;;2;0;2
18-ago-26;63;JUANA VALLEJO;Calle 5;Adoquinado de vias internas;14;;;;14;0;14
18-ago-26;64;KRANEC;Campo;Instalacion de protecciones colectivas;2;;;;2;0;2
18-ago-26;65;KUBIEC;Campo;Alquiler de encofrados;1;;;;1;0;1
18-ago-26;66;LICOSA;Campamento de oficinas;Campamento de oficinas;3;1;;;3;1;4
18-ago-26;67;LICOSA;Campo;Mediciones de Topografia;2;;;;2;0;2
18-ago-26;68;LICOSA;Cuadrante 14;Excavacion;3;;;;3;0;3
18-ago-26;69;LICOSA;Cuadrante 10;Relleno con grava;2;;;;2;0;2
18-ago-26;70;LICOSA;Calle 5;Tendido de material;2;;;;2;0;2
18-ago-26;71;LICOSA;Cuadrante 17;Compactacion ;2;;;;2;0;2
18-ago-26;72;LICOSA;Taller mecanico;Mecanica;1;;;;1;0;1
18-ago-26;73;LICOSA;Campo;Transporte externo de material;1;;;;1;0;1
18-ago-26;74;LICOSA;Campo;Transporte interno material ;4;;;;4;0;4
18-ago-26;75;METALCO;Cuadrante 20;Tecnico Administrativo;2;;;;2;;2
18-ago-26;76;METALCO;Cuadrante 20;Soldadura;14;;;;14;0;14
18-ago-26;77;MINDUSTRIAL;Edificio De Deshidratacion-CCM12;Tecnico Administrativo;3;;;;3;0;3
18-ago-26;78;MINDUSTRIAL;Edificio De Deshidratacion-CCM12;Montaje de bomba ;3;;;;3;0;3
18-ago-26;79;MOSS SECURITY;Puerta Sur;Vigilancia;2;;2;;4;0;4
18-ago-26;80;MOSS SECURITY;Puerta Norte;Vigilancia;2;;2;;4;0;4
18-ago-26;81;MOSS SECURITY;Cerramiento Interagua;Vigilancia;1;;;;1;0;1
18-ago-26;82;RICSON;Campamento de Oficinas y Campo;Tecnico Administrativo;1;2;;;1;2;3
18-ago-26;83;RICSON;Cuadrante 2, 12. 13, 15;Instalacion de tuberias;9;;;;9;0;9
18-ago-26;84;RICSON;Bodega;Bodeguero;1;;;;1;0;1
18-ago-26;85;"SCHUMACHER ECOMAG";Campamento de oficinas;Limpieza;2;;;;2;0;2
18-ago-26;86;SERP;E.B Cloruro Ferrico;Instalacion de tuberias electricas;3;;;;3;0;3
18-ago-26;87;SERP;Campamento de oficinas;Tecnico Administrativo;4;;;;4;0;4
18-ago-26;88;SERP;Edificio de Hipoclorito de Sodio, SubE N2-CCM4;Instalacion de tuberias electricas;3;;;;3;;3
18-ago-26;89;SERP;Clarificador 1;Instalacion de tuberias electricas;4;;;;4;0;4
18-ago-26;90;SERP;Calle 8;Instalacion de tuberias electricas;5;;;;5;0;5
18-ago-26;91;SIGMAN ;Edificio de Digestores, SubE N3-CCM8;Tecnico Administrativo;2;;;;2;0;2
18-ago-26;92;SIGMAN ;Edificio De Administracion y Operaciones;Instalacion de ductos;8;;;;8;;8
18-ago-26;93;SMAT ISP;Campamento de oficinas;Soporte IT;1;;;;1;0;1
18-ago-26;94;TECNIUM;Campo;Supervision montaje;4;;;;4;0;4
18-ago-26;95;TOPOCERO;Estacion de Bombeo del Afluente;Mediciones de Topografia;2;;;;2;0;2
18-ago-26;96;TOPOCERO;Puente vehicular;Mediciones de Topografia;2;;;;2;0;2
`;

export function getInitialPersonalData(): PersonalRegistro[] {
  const merinos = parsePersonalCsv(RAW_SAMPLE_PERSONAL_MERINOS, 'Merinos');
  return merinos;
}
