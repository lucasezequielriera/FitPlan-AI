import type { AppLocale } from "@/contexts/AppLocaleContext";

/** Textos compartidos Navbar / shell de la app */
export const navUi = {
  loading: { es: "Cargando...", en: "Loading…" },
  signIn: { es: "Iniciar sesión", en: "Sign in" },
  connected: { es: "Conectado", en: "Online" },
  language: { es: "Idioma", en: "Language" },
  signOut: { es: "Cerrar sesión", en: "Sign out" },
  menuAccount: { es: "Menú de cuenta", en: "Account menu" },
  menuAccountAdmin: { es: "Menú de cuenta · Administrador", en: "Account menu · Admin" },
  openMenuAdmin: { es: "Abrir menú de cuenta, administrador", en: "Open account menu, admin" },
  openMenuNamed: { es: "Abrir menú de cuenta", en: "Open account menu" },
  tagline: { es: "Crea tu plan personalizado", en: "Build your custom plan" },
  admin: { es: "Administrador", en: "Administrator" },
  goDashboard: { es: "Ir a mi dashboard", en: "Go to my dashboard" },
  myDashboard: { es: "Mi dashboard", en: "My dashboard" },
  dashboard: { es: "Dashboard", en: "Dashboard" },
  createPlan: { es: "Crear mi plan", en: "Create my plan" },
  loadingShort: { es: "Cargando…", en: "Loading…" },
  goAdminPanel: { es: "Ir al panel admin", en: "Go to admin panel" },
  goDashboardMenu: { es: "Ir al dashboard", en: "Go to dashboard" },
  createPlanMenu: { es: "Crear mi plan", en: "Create my plan" },
  myDashboardMenu: { es: "Mi dashboard", en: "My dashboard" },
  messagesAria: { es: "Abrir mensajes con el entrenador", en: "Open trainer messages" },
  gymThisMonth: { es: "Días de gym este mes", en: "Gym days this month" },
  gymAria: { es: "Calendario de gym", en: "Gym calendar" },
  gymDaysSuffix: { es: "días este mes", en: "days this month" },
  navHome: { es: "Inicio", en: "Home" },
  navMyPlan: { es: "Mi plan", en: "My plan" },
  navCreatePlan: { es: "Crear plan", en: "Create plan" },
  navMessages: { es: "Mensajes", en: "Messages" },
  navAccount: { es: "Cuenta", en: "Account" },
  navMainAria: { es: "Navegación principal", en: "Main navigation" },
  navViewSite: { es: "Ver sitio", en: "View site" },
  navContact: { es: "¿Alguna duda? Escríbeme", en: "Questions? Contact us" },
  navGymDays: { es: "Días de gym", en: "Gym days" },
  navNotifications: { es: "Notificaciones", en: "Notifications" },
  navAdminChat: { es: "Chat admin", en: "Admin chat" },
  navPendingSync: { es: "Pendiente sync", en: "Pending sync" },
  navClose: { es: "Cerrar", en: "Close" },
} as const;

export function ui(locale: AppLocale, key: keyof typeof navUi): string {
  return navUi[key][locale];
}

/** Dashboard · subset principal; amplía según necesites */
export const dashboardUi = {
  loading: { es: "Cargando...", en: "Loading…" },
  pageTitle: { es: "Mi Dashboard | FitPlan", en: "My Dashboard | FitPlan" },
  pageDesc: {
    es: "Gestioná tus planes de alimentación y entrenamiento personalizados. Seguimiento de progreso, peso y métricas de salud.",
    en: "Manage your personalized nutrition and training plans. Progress, weight, and health metrics.",
  },
  ogTitle: { es: "Mi Dashboard | FitPlan", en: "My Dashboard | FitPlan" },
  heading: { es: "Mi Dashboard", en: "My Dashboard" },
  subtitle: { es: "Gestiona tus planes nutricionales guardados", en: "Manage your saved nutrition plans" },
  contactTrainer: { es: "Contactar con mi entrenador", en: "Message my trainer" },
  requestTrainer: { es: "Pedir Entrenador Personal humano", en: "Request a human personal trainer" },
  premium: { es: "Ser Premium", en: "Go Premium" },
  newPlan: { es: "+ Nuevo Plan", en: "+ New plan" },
  newPlanLocked: {
    es: "Ya hay 1 plan creado. Con Premium, los planes son ilimitados",
    en: "You already have 1 plan. Upgrade to Premium for unlimited plans",
  },
  registerPremium: { es: "Hace falta una cuenta para acceder al plan Premium", en: "You must be signed in to access Premium" },
  noPlansTitle: { es: "No hay planes guardados", en: "No saved plans yet" },
  noPlansBody: { es: "Crea tu primer plan nutricional personalizado", en: "Create your first personalized nutrition plan" },
  createFirst: { es: "Crear mi primer plan", en: "Create my first plan" },
  planBase: { es: "Plan Base", en: "Base plan" },
  creation: { es: "Creación:", en: "Created:" },
  dateUnknown: { es: "Fecha no disponible", en: "Date unavailable" },
  goal: { es: "Objetivo:", en: "Goal:" },
  difficulty: { es: "Dificultad", en: "Difficulty" },
  month: { es: "Mes", en: "Month" },
  viewProgress: { es: "Ver progreso", en: "View progress" },
  deletePlan: { es: "Eliminar plan", en: "Delete plan" },
  unnamedPlan: { es: "Plan sin nombre", en: "Unnamed plan" },
  na: { es: "N/A", en: "N/A" },
  weightLabel: { es: "Peso:", en: "Weight:" },
  caloriesLabel: { es: "Calorías:", en: "Calories:" },
  adaptedFor: { es: "Adaptado para:", en: "Adapted for:" },
  adaptedTooltip: { es: "Plan adaptado para:", en: "Plan adapted for:" },
  cancel: { es: "Cancelar", en: "Cancel" },
  deleteModalTitle: { es: "¿Eliminar plan?", en: "Delete this plan?" },
  deleteModalBody: {
    es: "Esta acción no se puede deshacer. El plan será eliminado permanentemente.",
    en: "This action cannot be undone. The plan will be permanently deleted.",
  },
  deleteVerb: { es: "Eliminar", en: "Delete" },
  deleting: { es: "Eliminando...", en: "Deleting..." },
  errFirebase: { es: "Firebase no configurado", en: "Firebase is not configured" },
  errLoadPlans: { es: "Error al cargar tus planes guardados", en: "Could not load your saved plans" },
  errDeletePlan: { es: "No se pudo eliminar el plan. Por favor intenta de nuevo.", en: "Could not delete the plan. Please try again." },
  alertCannotDeleteBase: {
    es: "El Plan Base no se puede eliminar. Es tu plan principal y debe permanecer en tu cuenta. Actualiza a Premium para tener control total sobre todos tus planes.",
    en: "The base plan cannot be deleted. It is your main plan and must stay on your account. Upgrade to Premium for full control over all plans.",
  },
  trainerAssignedAlready: {
    es: "Ya había entrenador asignado. El contacto es por WhatsApp.",
    en: "You already had a trainer assigned. You can reach them on WhatsApp.",
  },
  trainerAssignedOk: {
    es: "Listo. Te asignamos a {name} para acompañarte en tu objetivo.",
    en: "Done. We assigned {name} to support your goal.",
  },
  trainerNameFallback: { es: "tu entrenador", en: "your trainer" },
  trainerRequestError: {
    es: "No se pudo procesar la solicitud.",
    en: "We could not process your request.",
  },

  /** Multi-fase (bulk/cut) */
  mfPhaseBulk: { es: "🏋️ Fase BULK", en: "🏋️ BULK phase" },
  mfPhaseCut: { es: "✂️ Fase CUT", en: "✂️ CUT phase" },
  mfPhaseLeanBulk: { es: "💎 Lean bulk", en: "💎 Lean bulk" },
  mfPhaseMaint: { es: "⚖️ Mantenimiento", en: "⚖️ Maintenance" },
  mfMonthOfTotal: { es: "Mes {current} de {total}", en: "Month {current} of {total}" },
  mfProgressThisMonth: { es: "Progreso del mes {n}", en: "Month {n} progress" },
  mfProgressFullProgram: { es: "Progreso del plan completo", en: "Full program progress" },
  mfMonthDoneNext: {
    es: "Mes {m} completado · abre el plan para generar el mes {next}.",
    en: "Month {m} complete · open your plan to generate month {next}.",
  },
  mfDaysLeftInMonth: {
    es: "{d} día(s) restante(s) del mes {m}",
    en: "{d} day(s) left in month {m}",
  },
  simplePlanProgress: { es: "Progreso del plan", en: "Plan progress" },
  planCompleted: { es: "Plan completado", en: "Plan completed" },
  daysRemaining: {
    es: "{n} día(s) restante(s)",
    en: "{n} day(s) left",
  },
  prepareContinuity: { es: "Preparar continuidad", en: "Prepare continuity" },

  /** Plan gratuito vencido */
  freeExpiredTitle: { es: "Tu plan gratuito ya venció", en: "Your free plan has ended" },
  freeExpiredBody: {
    es: "Se cumplieron los 30 días de acceso gratuito. Para seguir viendo tu plan y generar nuevas etapas, activa Premium.",
    en: "Your 30-day free access is over. To keep viewing your plan and generate new phases, upgrade to Premium.",
  },
  understood: { es: "Entendido", en: "Got it" },
  modalClose: { es: "Cerrar", en: "Close" },
  viewPremiumPlans: { es: "Ver planes Premium", en: "View Premium plans" },

  /** Modal entrenador personal */
  ptModalTitle: { es: "Entrenador personal humano", en: "Human personal trainer" },
  ptModalBody: {
    es: "Hay seguimiento humano 1:1: revisión del plan, ajustes según el avance real y respuestas por chat.",
    en: "Get 1:1 human follow-up: a review of your plan, adjustments based on your progress, and answers to your questions by chat.",
  },
  ptModalFootnote: {
    es: "Si ahora no toca, queda este botón y el chat para pedirlo más adelante.",
    en: "If you prefer not now, you can request it later with this button or via chat.",
  },
  ptChooseTrainer: { es: "Tipo de entrenador", en: "Choose your trainer type" },
  ptMaleTitle: { es: "Entrenador hombre", en: "Male trainer" },
  ptMaleBadge: { es: "Muy solicitado", en: "Popular" },
  ptMaleDesc: {
    es: "Especialista en hipertrofia y rendimiento deportivo.",
    en: "Specialist in hypertrophy and sports performance.",
  },
  ptFemaleTitle: { es: "Entrenadora mujer", en: "Female trainer" },
  ptFemaleBadge: { es: "Tendencia", en: "Trending" },
  ptFemaleDesc: {
    es: "Especialista en entrenamiento funcional, alto rendimiento y recomposición corporal.",
    en: "Specialist in functional training, high performance, and body recomposition.",
  },
  ptOptionalGoal: { es: "Objetivo principal (opcional)", en: "Tell us your main goal (optional)" },
  ptGoalPlaceholder: {
    es: "Ej.: bajar grasa, ganar masa, mejorar rendimiento…",
    en: "E.g. fat loss, muscle gain, better performance…",
  },
  ptNoThanks: { es: "No, gracias", en: "No thanks" },
  ptYesWant: { es: "Sí, quiero", en: "Yes, I want it" },
  ptProcessing: { es: "Procesando…", en: "Processing…" },

  /** Modal seguimiento / peso */
  progressModalTitle: { es: "Seguimiento de progreso", en: "Progress tracking" },
  progressPlanLabel: { es: "Plan:", en: "Plan:" },
  progressInitialWeight: { es: "Peso inicial:", en: "Starting weight:" },
  progressPlanPercent: { es: "Progreso del plan:", en: "Plan progress:" },
  progressDaysElapsed: { es: "Días transcurridos:", en: "Days elapsed:" },
  progressLoadingRecords: { es: "Cargando registros…", en: "Loading entries…" },
  progressRegisterMonthly: { es: "Registrar peso mensual", en: "Log monthly weight" },
  progressWeightPlaceholder: { es: "Peso actual: {n} kg", en: "Current weight: {n} kg" },
  progressSaving: { es: "Guardando…", en: "Saving…" },
  progressSave: { es: "Guardar", en: "Save" },
  progressHistory: { es: "Historial de pesos:", en: "Weight history:" },
  progressWeightChart: { es: "Evolución del peso", en: "Weight trend" },
  progressChartInitial: { es: "Peso inicial: {n} kg", en: "Starting: {n} kg" },
  progressChartLast: { es: "Último: {n} kg", en: "Latest: {n} kg" },
  progressChartEmpty: {
    es: "Registrá tu peso para ver la evolución",
    en: "Log your weight to see the chart",
  },
  deleteWeightTitle: { es: "¿Eliminar registro de peso?", en: "Delete this weight entry?" },
  deleteWeightBody: {
    es: "Se eliminará el registro del {date} ({kg} kg).",
    en: "This will remove the entry from {date} ({kg} kg).",
  },
  deleteWeightUndo: {
    es: "Esta acción no se puede deshacer.",
    en: "This action cannot be undone.",
  },
  errDeleteWeight: {
    es: "No se pudo eliminar el registro. Intentá de nuevo.",
    en: "Could not delete the entry. Please try again.",
  },
  deleteWeightRecord: { es: "Eliminar registro", en: "Delete entry" },

  /** Modal preparar continuidad (plan simple completado) */
  continuityTitleInput: { es: "Finalizar plan actual", en: "Finish current plan" },
  continuityTitleAnalyzing: { es: "Analizando resultados…", en: "Analyzing your results…" },
  continuityTitleSuggestion: { es: "Tu próximo paso", en: "Your next step" },
  continuityTitleGenerating: { es: "Generando tu plan…", en: "Generating your plan…" },
  continuityTitleDone: { es: "¡Listo!", en: "All set!" },
  continuityIntro: {
    es: "Completa los datos finales para recibir una sugerencia personalizada de continuidad.",
    en: "Complete the final details to get a personalized continuity suggestion.",
  },
  continuityWeightFinal: { es: "Peso final (kg)", en: "Final weight (kg)" },
  continuityWaistFinal: { es: "Cintura final (cm)", en: "Final waist (cm)" },
  continuityMealAdh: { es: "Adherencia a comidas", en: "Meal adherence" },
  continuityTrainAdh: { es: "Adherencia al entreno", en: "Training adherence" },
  continuityEnergy: { es: "Nivel de energía", en: "Energy level" },
  continuityRecovery: { es: "Recuperación", en: "Recovery" },
  continuityInjuries: { es: "Lesiones nuevas (opcional)", en: "New injuries (optional)" },
  continuityComments: { es: "Comentarios (opcional)", en: "Notes (optional)" },
  continuityInjuriesPh: {
    es: "Ej.: molestia en rodilla…",
    en: "E.g. mild knee discomfort…",
  },
  continuityCommentsPh: {
    es: "Cómo te sentiste durante el plan…",
    en: "How you felt during the plan…",
  },
  continuityAnalyzeCta: { es: "Analizar y obtener sugerencia", en: "Analyze and get suggestion" },
  continuityAnalyzingSub: {
    es: "Interpretando tus resultados con IA…",
    en: "Interpreting your results with AI…",
  },
  continuityAnalysisBlock: { es: "Resumen del ciclo", en: "Cycle summary" },
  continuityProgressLabel: { es: "Progreso", en: "Progress" },
  continuityPositive: { es: "Lo que funcionó", en: "What went well" },
  continuityImprove: { es: "A mejorar", en: "To improve" },
  continuitySugBlock: { es: "Sugerencia de continuidad", en: "Continuity suggestion" },
  continuityObjRecommended: { es: "Objetivo recomendado", en: "Recommended goal" },
  continuityUseSuggestion: { es: "Aplicar esta sugerencia al generar", en: "Apply this when generating" },
  continuityOtherOptions: { es: "Otras opciones", en: "Other options" },
  continuityCtaGenerate: { es: "Aceptar y generar plan", en: "Accept and generate plan" },
  continuityCtaGenerateWith: {
    es: "Generar plan con {goal}",
    en: "Generate plan with {goal}",
  },
  continuityGeneratingSub: {
    es: "Preparando tu nuevo plan personalizado…",
    en: "Preparing your personalized plan…",
  },
  continuityDoneTitle: { es: "Plan generado", en: "Plan created" },
  continuityDoneSub: {
    es: "Te llevamos a tu nuevo plan…",
    en: "Taking you to your new plan…",
  },
  continuityErrPeso: {
    es: "Ingresá un peso final válido.",
    en: "Enter a valid final weight.",
  },
  continuityErrAnalyze: {
    es: "No se pudo analizar. Intentá de nuevo.",
    en: "Could not analyze. Please try again.",
  },
  continuityErrGenerate: {
    es: "No se pudo generar el plan. Intentá de nuevo.",
    en: "Could not generate the plan. Please try again.",
  },

  /** Modal enviar mensaje (Navbar) */
  composeTitle: { es: "Enviar mensaje", en: "Send message" },
  composeSuccess: { es: "¡Mensaje enviado!", en: "Message sent!" },
  composeSuccessSub: { es: "Te responderemos pronto.", en: "We'll get back to you soon." },
  composeAnother: { es: "Enviar otro mensaje", en: "Send another" },
  composeSubjectOptional: { es: "Asunto (opcional)", en: "Subject (optional)" },
  composeSubjectPlaceholder: {
    es: "Ej.: consulta, error en el plan, Premium…",
    en: "E.g. question, plan issue, Premium…",
  },
  composeMessageLabel: { es: "Mensaje", en: "Message" },
  composeMessagePlaceholder: {
    es: "Escribe tu consulta, el error o lo que necesites…",
    en: "Write your question, issue, or request…",
  },
  composeSending: { es: "Enviando…", en: "Sending…" },
  composeSend: { es: "Enviar", en: "Send" },
  composeEmpty: { es: "El mensaje no puede estar vacío.", en: "Message cannot be empty." },
  composeError: { es: "No se pudo enviar el mensaje.", en: "Could not send the message." },
  composeDefaultSubject: { es: "Consulta", en: "Question" },

  /** Tarjeta dashboard · layout */
  cardAtAGlance: { es: "Resumen", en: "At a glance" },
  cardFooterHint: { es: "Pulsa para abrir el plan completo", en: "Tap to open your full plan" },
  cardOpenProgress: { es: "Progreso", en: "Progress" },

  /** Dashboard · reestructuración DESIGN_SYSTEM.md §13 */
  activePlanLabel: { es: "Plan activo", en: "Active plan" },
  viewMyPlan: { es: "Ver mi plan", en: "View my plan" },
  quickActionWeight: { es: "Registrar peso", en: "Log weight" },
  otherPlansTitle: { es: "Otros planes", en: "Other plans" },
  otherPlansEmpty: { es: "Todavía no hay otros planes.", en: "You don't have other plans yet." },
  newPlanShort: { es: "+ Nuevo plan", en: "+ New plan" },
  noPhaseLabel: { es: "Sin fase", en: "No phase" },
  upsellPremiumTitle: { es: "Hazte premium", en: "Go Premium" },
  upsellPremiumBody: {
    es: "Planes ilimitados y acceso completo a tu historial.",
    en: "Unlimited plans and full access to your history.",
  },
  sidebarWeightTitle: { es: "Registrar peso", en: "Log weight" },
  sidebarWeightBody: { es: "Carga rápida, sin abrir el detalle.", en: "Quick entry, no need to open the detail." },
  sidebarWeightSaved: { es: "Peso guardado.", en: "Weight saved." },
  sidebarWeightError: { es: "No se pudo guardar el peso.", en: "Could not save the weight." },
  sidebarTrainerTitle: { es: "Entrenador personal", en: "Personal trainer" },
  sidebarTrainerBody: {
    es: "Soporte humano vía WhatsApp para tu plan.",
    en: "Human support via WhatsApp for your plan.",
  },
  sidebarTrainerRequest: { es: "Solicitar", en: "Request" },
  sidebarTrainerContact: { es: "Contactar", en: "Contact" },
  daysRemainingShort: { es: "días restantes", en: "days left" },
  progressWeightInitialToCurrent: { es: "Peso inicial → actual", en: "Starting → current weight" },

  /** Modal mensajes (UserMessagesModal) */
  msgBackList: { es: "Volver a la lista", en: "Back to list" },
  msgTitle: { es: "Mis mensajes", en: "My messages" },
  msgUnreadOne: { es: "1 nueva", en: "1 new" },
  msgUnreadMany: { es: "{n} nuevas", en: "{n} new" },
  msgSubtitle: { es: "Conversaciones con tu entrenador", en: "Chats with your coach" },
  msgNewLong: { es: "Nuevo mensaje", en: "New message" },
  msgNewShort: { es: "Nuevo", en: "New" },
  msgChatEnded: { es: "Chat finalizado", en: "Chat closed" },
  msgReplied: { es: "✓ Respondido", en: "✓ Replied" },
  msgTheyWrote: { es: "Te escribieron", en: "They messaged you" },
  msgNewMessage: { es: "Nuevo mensaje", en: "New message" },
  msgBadgeReplied: { es: "Respondido", en: "Replied" },
  msgBadgeReply: { es: "Responder", en: "Reply" },
  msgBadgeNew: { es: "Mensaje nuevo", en: "New reply" },
  msgEmptyTitle: { es: "Aún no hay mensajes", en: "No messages yet" },
  msgEmptyBody: {
    es: "Escribe cuando quieras; te contesto por aquí.",
    en: "Message the team anytime, we reply here.",
  },
  msgSendFirst: { es: "Enviar primer mensaje", en: "Send first message" },
  msgStarted: { es: "Iniciado ·", en: "Started ·" },
  msgYou: { es: "Vos", en: "You" },
  msgConversation: { es: "Conversación", en: "Conversation" },
  msgTeamFitPlan: { es: "Equipo FitPlan", en: "FitPlan team" },
  msgNoReplies: { es: "Todavía no hay respuestas", en: "No replies yet" },
  msgNoRepliesSub: {
    es: "Cuando el equipo conteste, lo verás aquí.",
    en: "When the team replies, you'll see it here.",
  },
  msgChatClosedOn: { es: "Chat cerrado el", en: "Chat closed on" },
  msgThreadClosed: { es: "Este chat está cerrado", en: "This chat is closed" },
  msgThreadClosedSub: {
    es: "No se pueden enviar más mensajes en este hilo.",
    en: "You can't send more messages in this thread.",
  },
  msgYourReply: { es: "Tu respuesta", en: "Your reply" },
  msgReplyPlaceholder: { es: "Escribe tu mensaje…", en: "Write your message…" },
  msgSending: { es: "Enviando…", en: "Sending…" },
  msgSendReply: { es: "Enviar respuesta", en: "Send reply" },
  msgPickThread: {
    es: "Al seleccionar una conversación de la lista se abre el hilo completo.",
    en: "Pick a conversation from the list to see the full thread.",
  },
  msgLoadError: { es: "Error al cargar mensajes", en: "Could not load messages" },
  msgReplyError: { es: "Error al enviar respuesta", en: "Could not send reply" },
  msgUserFallback: { es: "Usuario", en: "User" },

  /** Modal calendario gym (GymCalendarModal) */
  gymTitle: { es: "Días de gym", en: "Gym days" },
  gymRegisteredMonth: { es: "{n} día(s) registrados este mes", en: "{n} day(s) logged this month" },
  gymPrevMonth: { es: "Mes anterior", en: "Previous month" },
  gymNextMonth: { es: "Mes siguiente", en: "Next month" },
  gymLoading: { es: "Cargando calendario…", en: "Loading calendar…" },
  gymHint: {
    es: "Toca un día pasado o hoy para marcar si entrenaste. Los días futuros no se pueden editar.",
    en: "Tap a past or today's date to log a workout. Future days can't be edited.",
  },
  gymStatThisMonth: { es: "Este mes", en: "This month" },
  gymStatDaysMarked: { es: "días marcados", en: "days logged" },
  gymStatYearTotal: { es: "Total {year}", en: "Total {year}" },
  gymStatDaysInYear: { es: "días en el año", en: "days this year" },
  gymChartTitle: { es: "Días por mes · {year}", en: "Days per month · {year}" },
  gymDone: { es: "Listo", en: "Done" },
  gymSaveError: { es: "Error al guardar. Intenta nuevamente.", en: "Could not save. Please try again." },
} as const;

export function dash(locale: AppLocale, key: keyof typeof dashboardUi): string {
  return dashboardUi[key][locale];
}

/** Reemplaza `{clave}` en textos de `dashboardUi` (p. ej. `{n}`, `{m}`). */
export function dashFmt(locale: AppLocale, key: keyof typeof dashboardUi, vars: Record<string, string | number>): string {
  let s: string = dashboardUi[key][locale] as string;
  for (const [k, v] of Object.entries(vars)) {
    const needle = `{${k}}`;
    s = s.split(needle).join(String(v));
  }
  return s;
}

/** Objetivos de plan (valores internos → etiqueta UI) */
export function goalLabel(locale: AppLocale, objetivo: string | undefined): string {
  const es: Record<string, string> = {
    perder_grasa: "Perder grasa",
    mantener: "Mantener peso",
    ganar_masa: "Ganar masa",
    recomposicion: "Recomposición",
    definicion: "Definición",
    volumen: "Volumen",
    corte: "Corte",
    mantenimiento_avanzado: "Mantenimiento avanzado",
    bulk_cut: "Bulk + Cut",
    lean_bulk: "Lean Bulk",
    rendimiento_deportivo: "Rendimiento deportivo",
    powerlifting: "Powerlifting",
    resistencia: "Resistencia",
    atleta_elite: "Atleta élite",
  };
  const en: Record<string, string> = {
    perder_grasa: "Fat loss",
    mantener: "Maintenance",
    ganar_masa: "Muscle gain",
    recomposicion: "Recomposition",
    definicion: "Cut / definition",
    volumen: "Bulk",
    corte: "Cut",
    mantenimiento_avanzado: "Advanced maintenance",
    bulk_cut: "Bulk + cut",
    lean_bulk: "Lean bulk",
    rendimiento_deportivo: "Sports performance",
    powerlifting: "Powerlifting",
    resistencia: "Endurance",
    atleta_elite: "Elite athlete",
  };
  if (!objetivo) return locale === "en" ? "N/A" : "N/A";
  const map = locale === "en" ? en : es;
  if (map[objetivo]) return map[objetivo];
  const pretty = objetivo.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Títulos "Plan: …" en tarjetas */
export function planCardTitle(locale: AppLocale, objetivo: string | undefined, isOldest: boolean, fallbackName: string): string {
  if (isOldest) return locale === "en" ? "Base plan" : "Plan Base";
  const prefix = locale === "en" ? "Plan:" : "Plan:";
  const label = goalLabel(locale, objetivo);
  if (objetivo && label) return `${prefix} ${label}`;
  return fallbackName;
}

/** Dificultad almacenada (facil/media/dificil) → etiqueta UI */
export function difficultyLabel(locale: AppLocale, raw: string | undefined): string {
  const s = String(raw || "").toLowerCase();
  if (locale === "en") {
    if (s === "facil") return "Easy";
    if (s === "media") return "Medium";
    if (s === "dificil") return "Hard";
  }
  if (s === "facil") return "Fácil";
  if (s === "media") return "Media";
  if (s === "dificil") return "Difícil";
  return String(raw || "");
}
