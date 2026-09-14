# Cómo se reconoce un texto escrito por una IA

Referencia para todo el texto visible de FitPlan. Sale de [Wikipedia: *Signs of AI writing*](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), que es la lista más detallada que existe —la mantienen editores que llevan años borrando artículos generados a máquina— y de [*AI slop*](https://en.wikipedia.org/wiki/AI_slop).

**Por qué importa en FitPlan y no es una manía estética.** La app se vende como "plan generado con IA". Si además el texto *suena* a IA, el visitante concluye que no hay nadie detrás: que se registró, que pagó y que le atenderá un robot. La página tiene que sonar a la persona que sí está detrás. Es lo contrario del problema: la IA hace el plan, el texto lo escribe Lucas.

Y hay precedente en este repo: ya hubo que retirar la afirmación de que había "nutricionistas y entrenadores profesionales" detrás, porque era falsa. Un texto que suena a máquina produce el mismo daño sin decir ninguna mentira.

> No existe versión en español de esta página de Wikipedia (comprobado: da 404). Las señales de abajo están adaptadas, no traducidas: varias se manifiestan distinto en castellano.

---

## 1. Las señales de fondo

### Importancia inflada
Frases que anuncian que algo es importante en vez de demostrarlo.

> "marca un antes y un después", "representa un cambio significativo", "sienta las bases para", "subraya la importancia de", "en un mundo donde…"

**En su lugar:** dí el hecho. Si es importante, se nota solo.

### Lenguaje de folleto
Tono de agencia de viajes o nota de prensa.

> "vibrante", "enclavado en", "en el corazón de", "revolucionario", "de vanguardia", "una amplia gama de", "cuenta con", "experiencia única"

### Análisis de adorno
Gerundios pegados al final que fingen conclusión sin aportar nada.

> "…, potenciando tu rendimiento", "…, fomentando hábitos duraderos", "…, reflejando tu compromiso", "…, impulsando tu progreso"

**Prueba:** tápalo con el dedo. Si la frase dice exactamente lo mismo, sobraba.

### Atribución vaga
Autoridad sin nombre.

> "los expertos coinciden", "estudios demuestran", "está comprobado que", "se sabe que"

**En FitPlan esto es peligroso**, no solo feo: es la puerta por la que vuelven las afirmaciones sobre credenciales que no tenemos.

### La fórmula "a pesar de"
> "A pesar de sus [cosas buenas], [sujeto] afronta varios retos…"

---

## 2. Las señales de forma

### Evitar el verbo "ser"
La IA huye de "es". En castellano se nota en:

> "se erige como", "funciona como", "representa", "constituye", "se configura como", "cuenta con", "ofrece"

**En su lugar:** *es*, *tiene*, *hace*.

### Paralelismos negativos
La más reconocible de todas. Dos formas:

> "No solo X, sino también Y"
> "No es X, es Y"

En castellano también: *"Más que un plan, es un método"*, *"No se trata de entrenar más, sino mejor"*.

Es la construcción que más delata un texto, porque suena a conclusión sin serlo.

### Regla de tres
Tres elementos en lista como si el mundo viniera de tres en tres.

> "constancia, método y resultados"

Una vez es retórica. Tres veces en la misma página es una máquina.

### Vocabulario de alta densidad
Palabras que aparecen juntas en textos generados con una frecuencia que no tienen en el habla real:

> además · profundizar · crucial · clave · panorama · meticuloso · fundamental · integral · holístico · robusto · aprovechar · optimizar · maximizar · potenciar · fomentar · destacar · abordar · en última instancia · sin duda

### Conexión indirecta
> "en relación con", "asociado a", "vinculado con"

**En su lugar:** dí quién hace qué.

---

## 3. Las señales tipográficas

| Señal | Qué hacer |
|---|---|
| Raya larga (`—`) usada sin parar | Punto o coma. Una raya por página, como mucho |
| Emoji como separador o viñeta | Fuera |
| Mayúsculas De Título En Los Titulares | Solo la primera palabra, como en castellano |
| **Negrita** cada dos frases | Reservarla para lo que de verdad importa |
| Comillas tipográficas mezcladas con rectas | Elegir una y mantenerla |
| Todo convertido en lista de viñetas | Escribir párrafos |

---

## 4. Las tres pruebas rápidas

1. **¿Lo diría en voz alta?** Si al leerlo suena a presentación corporativa, no.
2. **Tápalo con el dedo.** Si quitas la última coma y todo lo que viene detrás, ¿se pierde algo? Si no, sobraba.
3. **¿Podría estar en la web de cualquier otro?** Si la frase vale igual para una app de idiomas, no dice nada de FitPlan.

---

## 5. Lo que sí suena a persona

- **Números concretos** en vez de adjetivos. "56 personas" dice más que "una comunidad creciente".
- **Frases de longitud desigual.** La IA escribe frases del mismo tamaño. Las personas no. A veces cortas. Muy cortas.
- **Admitir límites.** "Esto no es para ti si buscas resultados en dos semanas" genera más confianza que cualquier promesa.
- **Primera persona real.** Detrás de FitPlan hay una persona. Que se note.
- **Palabras normales.** *Usar*, no *utilizar*. *Hacer*, no *realizar*. *Empezar*, no *iniciar*.

---

## 6. Lo que NO es una señal

Que un texto esté bien escrito no lo delata. Ni que use comas correctamente, ni que esté ordenado. La señal es la **combinación** de varias de las de arriba en poco espacio — y sobre todo, decir mucho sin afirmar nada comprobable.

`landingClaims.test.ts` cubre el caso extremo: afirmaciones falsas. Esto es el escalón anterior — frases que no son falsas pero tampoco dicen nada.
