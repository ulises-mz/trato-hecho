// Datos del caso. Todo lo que ven los equipos y lo que calcula el tablero sale
// de aquí: cambiar un número acá cambia la web y puntuar.py por igual.
// El objeto es JSON válido a propósito: puntuar.py lo lee quitando la primera
// línea y el punto y coma final.
window.DATOS =
{
  "nombre": "Trato Hecho",
  "lema": "Simulador de negociación para emprendedores",
  "curso": "Desarrollo de Emprendedores · Grupo 4 · CEP: Negociación",
  "tiempos": {
    "consigna": 60,
    "preparacion": 240,
    "negociacion": 600,
    "cierre": 60,
    "debrief": 240
  },
  "contexto": {
    "titulo": "Café Volcán contrata a Órbita Studio",
    "parrafos": [
      "Café Volcán es una cafetería nueva en Cartago. Abre pronto y todavía no existe en internet: necesita un sitio web con el menú y pedidos en línea, un logo y el lanzamiento de sus redes sociales.",
      "Órbita Studio es una agencia digital joven, de tres personas, que ofrece exactamente ese paquete.",
      "Hoy se sientan a negociar el contrato. Hay cinco temas sobre la mesa y cada tema tiene opciones. Cada parte tiene una tabla de puntos privada: nadie sabe cuánto vale cada opción para el otro lado."
    ],
    "reglas": [
      "La tabla de puntos es privada. No se muestra la pantalla ni se leen los puntos en voz alta. Sí se puede decir qué les importa y por qué.",
      "Hay 10 minutos para negociar. Si no hay acuerdo cuando se acabe el tiempo, cada parte se queda con su plan B.",
      "El trato se cierra cuando las dos partes dicen «trato hecho» y lo confirman en la web: solo se puede cerrar si las propuestas de los dos equipos coinciden.",
      "Gana la sala que crea más valor para las dos partes. Un trato que deja a una parte por debajo de su plan B no cuenta."
    ]
  },
  "puntaje": {
    "titulo": "Cómo se decide la mejor negociación",
    "lineas": [
      "Cada parte suma los puntos de las opciones acordadas. El máximo es 100.",
      "Índice ganar-ganar de la sala = puntos de las dos partes − la mitad de la diferencia entre ellas.",
      "Ejemplo: 70 y 70 dan 140. 95 y 45 dan 140 − 25 = 115. Exprimir al otro cuesta puntos.",
      "Si una parte queda por debajo de su plan B, el trato no cuenta: debió levantarse de la mesa.",
      "Sin acuerdo, cada parte se queda con los puntos de su plan B. Al registrarlo se anota la última propuesta que hubo sobre la mesa y quién la rechazó: si esa propuesta era mejor que el plan B de los dos, cuenta como trato perdido; si no, levantarse fue lo correcto."
    ]
  },
  "lados": {
    "agencia": {
      "nombre": "Órbita Studio",
      "rol": "Agencia",
      "etiqueta": "Agencia · Órbita Studio",
      "quienes": "Son tres personas y llevan un año operando. Hacen buen trabajo, pero tienen pocos casos que mostrar y les cuesta conseguir clientes nuevos. Este contrato les sirve por el dinero y, sobre todo, por lo que viene después.",
      "posicion": "«El paquete completo cuesta ₡1 millón, con 50 % por adelantado. Entregamos en 4 semanas, con 2 rondas de cambios y 1 mes de soporte, y nuestro logo va en el pie de página del sitio.»",
      "intereses": [
        { "titulo": "Cobrar algo al firmar", "texto": "La primera semana tienen que pagarle a una fotógrafa freelance. Sin adelanto, la plata sale de su bolsillo." },
        { "titulo": "Crecer", "texto": "Un testimonio en video y dos contactos nuevos valen más que ₡100 mil de diferencia en el precio." },
        { "titulo": "Precio", "texto": "El paquete les cuesta unos ₡550 mil entre horas y freelancers. Con ₡600 mil apenas no pierden." },
        { "titulo": "No prometer 2 semanas", "texto": "Serían horas extra y riesgo de entregar mal. Entregar lo esencial primero y el resto después sí les funciona." },
        { "titulo": "Soporte", "texto": "Tres meses de soporte les cuestan poco si el sitio queda bien hecho. Cambios ilimitados son un hueco sin fondo." }
      ],
      "planB": {
        "texto": "Un consultorio dental les ofreció un proyecto más pequeño, pagado por adelantado.",
        "puntos": 45,
        "aviso": "Cualquier trato por debajo de 45 puntos es peor que levantarse de la mesa."
      },
      "consejos": [
        "Pregunten para cuándo es la apertura y qué necesitan tener listo ese día.",
        "Ofrezcan lo que a ustedes les cuesta poco (soporte) a cambio de lo que les importa (adelanto, testimonio, referidos).",
        "No se queden peleando solo por el precio: vale 30 de sus 100 puntos.",
        "Anclen alto, pero con una razón. Una exigencia sin explicación cierra la conversación."
      ],
      "preparacion": [
        { "id": "objetivo", "pregunta": "¿Qué queremos lograr en esta mesa?" },
        { "id": "minimo", "pregunta": "¿Cuál es nuestro mínimo? Tiene que superar los 45 del plan B." },
        { "id": "preguntas", "pregunta": "¿Qué le vamos a preguntar al cliente antes de ofrecer nada?" }
      ]
    },
    "cliente": {
      "nombre": "Café Volcán",
      "rol": "Cliente",
      "etiqueta": "Cliente · Café Volcán",
      "quienes": "Son dos socios y la inauguración es en cinco semanas. Todavía no venden nada, así que el dinero está contado hasta la apertura. Ninguno de los dos sabe de tecnología.",
      "posicion": "«Lo queremos todo en 2 semanas y pagamos cuando esté terminado. El presupuesto es ₡600 mil y no queremos publicidad de nadie en nuestro sitio.»",
      "intereses": [
        { "titulo": "Que el menú y los pedidos funcionen el día de la inauguración", "texto": "Eso es en cinco semanas. El logo y las redes pueden llegar después. Las «2 semanas» son un colchón, no una necesidad." },
        { "titulo": "Soporte", "texto": "No saben de tecnología. Que alguien responda cuando algo falle vale muchísimo." },
        { "titulo": "Precio", "texto": "Tienen hasta ₡900 mil si el trato lo justifica, pero cada colón que ahorren es inventario para abrir." },
        { "titulo": "Pago", "texto": "Prefieren pagar después de abrir, pero pueden adelantar una parte si el resto del trato lo compensa." },
        { "titulo": "Publicidad", "texto": "Un logo pequeño no les molesta y grabar un testimonio es media hora. Lo dijeron por costumbre de regatear." }
      ],
      "planB": {
        "texto": "Un primo hace un sitio con plantilla por ₡450 mil, sin pedidos en línea y sin soporte.",
        "puntos": 40,
        "aviso": "Cualquier trato por debajo de 40 puntos es peor que decirle que sí al primo."
      },
      "consejos": [
        "Digan para qué necesitan el sitio rápido. Quizá hay otra forma de lograrlo.",
        "Pregunten por qué piden adelanto. Puede haber un arreglo intermedio.",
        "Lo que a ustedes les cuesta poco (un testimonio, un logo en el pie) puede valer mucho para la agencia. Cóbrenlo en soporte o en precio.",
        "El precio vale 35 de sus 100 puntos. Los otros 65 están en el resto de la mesa."
      ],
      "preparacion": [
        { "id": "objetivo", "pregunta": "¿Qué necesitamos de verdad para el día de la apertura?" },
        { "id": "minimo", "pregunta": "¿Cuál es nuestro mínimo? Tiene que superar los 40 del plan B." },
        { "id": "preguntas", "pregunta": "¿Qué le vamos a preguntar a la agencia antes de aceptar nada?" }
      ]
    }
  },
  "temas": [
    {
      "id": "precio",
      "nombre": "Precio del paquete",
      "pregunta": "¿Cuánto paga Café Volcán por el paquete completo?",
      "opciones": [
        { "letra": "A", "texto": "₡600 mil", "agencia": 0, "cliente": 35 },
        { "letra": "B", "texto": "₡700 mil", "agencia": 8, "cliente": 26 },
        { "letra": "C", "texto": "₡800 mil", "agencia": 15, "cliente": 18 },
        { "letra": "D", "texto": "₡900 mil", "agencia": 23, "cliente": 9 },
        { "letra": "E", "texto": "₡1 millón", "agencia": 30, "cliente": 0 }
      ]
    },
    {
      "id": "plazo",
      "nombre": "Plazo de entrega",
      "pregunta": "¿Cuándo entrega la agencia?",
      "opciones": [
        { "letra": "A", "texto": "Todo en 2 semanas", "agencia": 0, "cliente": 20 },
        { "letra": "B", "texto": "Todo en 3 semanas", "agencia": 5, "cliente": 17 },
        { "letra": "C", "texto": "Todo en 4 semanas", "agencia": 12, "cliente": 12 },
        { "letra": "D", "texto": "Todo en 6 semanas", "agencia": 15, "cliente": 0 },
        { "letra": "E", "texto": "Por fases: menú y pedidos en 2 semanas, el resto en 4", "agencia": 13, "cliente": 19 }
      ]
    },
    {
      "id": "pago",
      "nombre": "Forma de pago",
      "pregunta": "¿Cuándo se paga?",
      "opciones": [
        { "letra": "A", "texto": "100 % al entregar", "agencia": 0, "cliente": 10 },
        { "letra": "B", "texto": "30 % al firmar + 70 % al entregar", "agencia": 12, "cliente": 7 },
        { "letra": "C", "texto": "50 % al firmar + 50 % al entregar", "agencia": 22, "cliente": 3 },
        { "letra": "D", "texto": "40 % al firmar + 30 % a mitad + 30 % al entregar", "agencia": 25, "cliente": 5 }
      ]
    },
    {
      "id": "soporte",
      "nombre": "Cambios y soporte",
      "pregunta": "¿Cuántas rondas de cambios y cuánto soporte después de entregar?",
      "opciones": [
        { "letra": "A", "texto": "1 ronda de cambios, sin soporte", "agencia": 10, "cliente": 0 },
        { "letra": "B", "texto": "2 rondas + 1 mes de soporte", "agencia": 8, "cliente": 10 },
        { "letra": "C", "texto": "3 rondas + 3 meses de soporte", "agencia": 5, "cliente": 20 },
        { "letra": "D", "texto": "Cambios ilimitados + 6 meses de soporte", "agencia": 0, "cliente": 25 }
      ]
    },
    {
      "id": "reconocimiento",
      "nombre": "Reconocimiento",
      "pregunta": "¿Qué recibe la agencia además del pago?",
      "opciones": [
        { "letra": "A", "texto": "Nada: sin mención de la agencia", "agencia": 0, "cliente": 10 },
        { "letra": "B", "texto": "Logo de la agencia en el pie de página", "agencia": 8, "cliente": 8 },
        { "letra": "C", "texto": "Logo + testimonio en video", "agencia": 14, "cliente": 5 },
        { "letra": "D", "texto": "Logo + testimonio + presentación a 2 contactos", "agencia": 20, "cliente": 3 }
      ]
    }
  ],
  "revelacion": {
    "intro": "Las dos tablas, una al lado de la otra. Lo que valía poco para un lado y mucho para el otro era donde estaba el valor escondido.",
    "claves": [
      { "titulo": "Posición vs. interés", "texto": "El cliente pedía «2 semanas», pero lo que necesitaba era el menú y los pedidos listos para la inauguración, en cinco semanas. Entregar por fases valía 19 para el cliente y 13 para la agencia: casi lo mejor para los dos. Quien preguntó «¿para qué lo necesitan tan rápido?» lo encontró." },
      { "titulo": "Dar lo barato, cobrar lo caro", "texto": "Tres meses de soporte le costaban 5 puntos a la agencia y le daban 20 al cliente. Un testimonio con referidos le costaba 7 al cliente y le daba 20 a la agencia. Cambiar uno por otro creaba valor sin que nadie perdiera." },
      { "titulo": "El precio era menos de la mitad", "texto": "El precio valía 30 puntos para la agencia y 35 para el cliente. Las salas que solo regatearon el precio dejaron 65 puntos sin tocar." },
      { "titulo": "El plan B", "texto": "La agencia tenía un consultorio dental esperando (45 puntos); el cliente, un primo con una plantilla (40). Quien cerró por debajo de eso aceptó un trato feo por desesperación. Levantarse de la mesa también era negociar bien, siempre que lo que había sobre la mesa fuera peor que el plan B; dejar ir un trato que convenía a los dos es un trato perdido." }
    ],
    "debrief": [
      "¿Preguntaron por qué la otra parte quería lo que pedía?",
      "¿Qué dieron que a ustedes les costaba poco y al otro le valía mucho?",
      "¿Alguien cerró por debajo de su plan B? ¿Qué los empujó a aceptar?"
    ]
  },
  "ejemplo": [
    { "sala": 1, "codigo": "S1-BEDCD" },
    { "sala": 2, "codigo": "S2-CBCBB" },
    { "sala": 3, "codigo": "S3-EDCAB" },
    { "sala": 4, "codigo": "S4-SIN-EDBAB-C" },
    { "sala": 5, "codigo": "S5-CECCC" },
    { "sala": 6, "codigo": "S6-ABADD" },
    { "sala": 7, "codigo": "S7-SIN-CCBBB-T" },
    { "sala": 8, "codigo": "S8-SIN" }
  ]
}
;
