/**
 * Configuración del envío compartida entre el navegador (checkout) y el servidor
 * (rutas de API). Sin imports de servidor: el checkout lo importa y no puede
 * arrastrar al bundle del cliente el código que habla con la API de Correo.
 */

/** true = el envío se cotiza con Correo Argentino y lo paga el cliente.
 *  false = envío "a convenir" (sin costo en el checkout, se coordina por WhatsApp). */
export const ENVIO_CORREO_HABILITADO = true;

/** CP de origen de los envíos. CasaAmor: 1621 Benavidez (GBA Norte). */
export const CP_ORIGEN = "1621";
