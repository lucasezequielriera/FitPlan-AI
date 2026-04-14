/**
 * Meal templates in English (free-tier template plans).
 * Structure mirrors `templateComidas` in templatePlans.ts.
 */
export const templateComidasEn = {
  estandar: {
    desayuno: [
      { nombre: "Scrambled eggs", opciones: ["3 eggs + 2 whole-wheat toasts + coffee with milk", "3 eggs + oats + banana + coffee"] },
      { nombre: "French toast", opciones: ["2 toasts + egg + blueberries + honey", "2 toasts + Greek yogurt + granola"] },
      { nombre: "Protein pancakes", opciones: ["Pancakes (2) + blueberries + syrup", "Pancakes (2) + peanut butter + banana"] },
      { nombre: "Smoothie", opciones: ["Protein + banana + oats + milk", "Protein + berries + yogurt + granola"] },
    ],
    almuerzo: [
      { nombre: "Chicken and rice", opciones: ["Breast 200g + rice 150g + broccoli", "Breast 200g + brown rice 150g + carrot"] },
      { nombre: "Salmon and sweet potato", opciones: ["Salmon 180g + sweet potato 150g + spinach", "Salmon 150g + sweet potato 200g + salad"] },
      { nombre: "Beef and potatoes", opciones: ["Lean beef 200g + potatoes 150g + salad", "Beef 180g + potatoes 150g + vegetables"] },
      { nombre: "Turkey and quinoa", opciones: ["Turkey 200g + quinoa 150g + vegetables", "Turkey 180g + quinoa 100g + tomato sauce"] },
    ],
    merienda: [
      { nombre: "Fruit + protein", opciones: ["Banana + 30g almonds", "Apple + 30g walnuts", "Orange + 25g pistachios"] },
      { nombre: "Yogurt + granola", opciones: ["Greek yogurt 200g + granola 50g + honey", "Plain yogurt 200g + granola 40g + fruit"] },
      { nombre: "Light shake", opciones: ["Protein + banana + oats + milk", "Protein + fruit + yogurt"] },
      { nombre: "Protein bar", opciones: ["Protein bar + coffee", "Homemade bar + tea"] },
    ],
    cena: [
      { nombre: "Chicken breast + vegetables", opciones: ["Breast 200g + sweet potato 150g + broccoli", "Breast 180g + potato 150g + spinach"] },
      { nombre: "White fish", opciones: ["Hake 200g + rice 100g + vegetables", "Sole 180g + quinoa 150g + salad"] },
      { nombre: "Eggs + vegetables", opciones: ["4 whites + 1 yolk + 200g vegetables + 50g rice", "3 whole eggs + vegetables"] },
      { nombre: "Legumes", opciones: ["Lentils 200g + vegetables + garlic", "Chickpeas 200g + onion + tomato"] },
    ],
  },
  vegana: {
    desayuno: [
      { nombre: "Oats with fruit", opciones: ["Oats 50g + banana + berries + almond milk", "Oats 50g + apple + cinnamon + soy milk"] },
      { nombre: "Tofu toast", opciones: ["Scrambled tofu + 2 whole-wheat toasts + avocado", "Scrambled tofu + whole bread + vegetables"] },
      { nombre: "Vegan smoothie", opciones: ["Plant protein + banana + peanut butter + oat milk", "Plant protein + berries + almonds + soy milk"] },
      { nombre: "Homemade granola", opciones: ["Granola 60g + coconut milk + fruit", "Granola 50g + vegan yogurt + berries"] },
    ],
    almuerzo: [
      { nombre: "Tofu and rice", opciones: ["Tofu 200g + rice 150g + sautéed broccoli", "Smoked tofu 200g + brown rice + vegetables"] },
      { nombre: "Lentils and quinoa", opciones: ["Lentils 200g + quinoa 150g + vegetables", "Lentils 180g + quinoa 100g + tomato sauce"] },
      { nombre: "Chickpeas and sweet potato", opciones: ["Chickpeas 180g + sweet potato 200g + spinach", "Roasted chickpeas 150g + sweet potato 200g + salad"] },
      { nombre: "Whole-wheat pasta", opciones: ["Pasta 200g + tomato sauce + vegetables + tofu", "Whole pasta 150g + vegan sauce + broccoli"] },
    ],
    merienda: [
      { nombre: "Fruit + seeds", opciones: ["Banana + 30g sunflower seeds", "Apple + 20g almonds + dates"] },
      { nombre: "Hummus + vegetables", opciones: ["Hummus 100g + carrot + cucumber + toast", "Hummus 80g + whole bread 2 slices"] },
      { nombre: "Vegan protein bar", opciones: ["Plant protein bar + tea", "Homemade nut bar + fruit"] },
      { nombre: "Protein shake", opciones: ["Plant protein + almond milk + berries", "Pea protein + banana + soy milk"] },
    ],
    cena: [
      { nombre: "Stir-fried tofu", opciones: ["Tofu 200g + rice 100g + stir-fried vegetables", "Tofu 180g + potato 150g + steamed vegetables"] },
      { nombre: "Lentil soup", opciones: ["Lentils 200g + vegetables + vegetable stock", "Lentils 180g + onion + garlic + carrot"] },
      { nombre: "Veggie burger", opciones: ["Plant patty + whole bun + salad + baked fries", "Legume cutlet + bread + vegetables"] },
      { nombre: "Grilled tempeh", opciones: ["Tempeh 150g + potatoes 150g + broccoli", "Tempeh 180g + quinoa + vegetables"] },
    ],
  },
  keto: {
    desayuno: [
      { nombre: "Eggs + avocado", opciones: ["3 eggs + 1/2 avocado + ham", "4 scrambled eggs + cheese + bacon"] },
      { nombre: "Butter coffee", opciones: ["Coffee + 2 tbsp butter + cream", "Coffee + coconut oil + cream"] },
      { nombre: "Cheese omelette", opciones: ["Omelette 3 eggs + 50g cheese + spinach", "Omelette 4 eggs + mushrooms + cheese"] },
      { nombre: "Greek yogurt", opciones: ["Greek yogurt 200g + walnuts + flax seeds", "Greek yogurt 200g + almonds + cocoa"] },
    ],
    almuerzo: [
      { nombre: "Meat + fats", opciones: ["Beef 250g + avocado + olive oil salad", "Ribs 250g + butter + low-carb vegetables"] },
      { nombre: "Salmon + mayo", opciones: ["Salmon 200g + homemade mayo + green salad", "Salmon 200g + hollandaise + broccoli"] },
      { nombre: "Chicken + sauce", opciones: ["Chicken 250g + keto BBQ + cheese salad", "Chicken 200g + cream sauce + mushrooms"] },
      { nombre: "Stuffed eggs", opciones: ["4 eggs stuffed with cheese + ham + bacon", "3 stuffed eggs + avocado + bacon"] },
    ],
    merienda: [
      { nombre: "Cheese + nuts", opciones: ["50g cheese + 30g almonds + olives", "100g cheese + 20g walnuts + jerky"] },
      { nombre: "Hard-boiled eggs", opciones: ["3 hard-boiled eggs + salt + pepper", "4 eggs + mayo"] },
      { nombre: "Fatty snack", opciones: ["Crispy bacon + cheese", "Pork rinds + guacamole"] },
      { nombre: "Whipped cream", opciones: ["Whipped cream 100g + cocoa", "Whipped cream + strawberries"] },
    ],
    cena: [
      { nombre: "Steak + butter", opciones: ["Steak 250g + compound butter + spinach", "Steak 200g + mushroom sauce + salad"] },
      { nombre: "Fatty fish", opciones: ["Mackerel 200g + avocado + salad", "Trout 200g + cheese sauce + cauliflower"] },
      { nombre: "Juicy pork", opciones: ["Pork ribs 250g + roasted cauliflower", "Chops 200g + cream sauce + spinach"] },
      { nombre: "Eggs + cheese", opciones: ["6-egg tortilla + cheese + ham + spinach", "5-egg scramble + cheese + mushrooms"] },
    ],
  },
  mediterranea: {
    desayuno: [
      { nombre: "Bread + tomato", opciones: ["Whole bread + tomato + olive oil + serrano ham", "Whole bread + ricotta + tomato + oregano"] },
      { nombre: "Granola + honey", opciones: ["Granola 60g + Greek yogurt + honey + almonds", "Granola 50g + plain yogurt + berries"] },
      { nombre: "Greek eggs", opciones: ["2 eggs + tomato + feta + olive oil", "Omelette + spinach + tomato + cheese"] },
      { nombre: "Mediterranean smoothie", opciones: ["Yogurt + orange + almonds + honey", "Yogurt + berries + granola + honey"] },
    ],
    almuerzo: [
      { nombre: "Grilled swordfish", opciones: ["Swordfish 200g + lemon + olive oil + salad", "Swordfish 180g + baked potatoes + vegetables"] },
      { nombre: "Roast chicken", opciones: ["Chicken 200g + tomato + olives + herbs", "Chicken 200g + lemon + rosemary + vegetables"] },
      { nombre: "Pasta + tomato", opciones: ["Whole pasta 200g + tomato sauce + vegetables + parmesan", "Pasta 150g + red sauce + garlic + basil"] },
      { nombre: "Greek salad", opciones: ["Greek salad + feta 100g + olives + whole bread", "Tomato + cucumber + onion + cheese + olive oil"] },
    ],
    merienda: [
      { nombre: "Fruit + cheese", opciones: ["Apple + 50g goat cheese", "Grapes + 50g parmesan"] },
      { nombre: "Toasted bread", opciones: ["Whole toast + tomato + olive oil + garlic", "Toast + hummus + vegetables"] },
      { nombre: "Olives + cheese", opciones: ["100g mixed olives + 50g cheese", "Olives + almonds + cheese"] },
      { nombre: "Yogurt + honey", opciones: ["Greek yogurt 200g + honey + walnuts", "Plain yogurt + honey + almonds"] },
    ],
    cena: [
      { nombre: "Baked sea bass", opciones: ["Sea bass 200g + lemon + olive oil + baked potatoes", "Sea bass 180g + tomato + herbs + salad"] },
      { nombre: "Mussels in wine", opciones: ["Mussels 250g + white wine + garlic + bread", "Mussels 200g + tomato + parsley"] },
      { nombre: "Lemon chicken", opciones: ["Chicken 200g + lemon + garlic + potatoes + salad", "Chicken 180g + lemon + rosemary + vegetables"] },
      { nombre: "Stuffed vegetables", opciones: ["Stuffed tomatoes + rice + herbs", "Eggplant + ricotta + tomato + cheese"] },
    ],
  },
} as const;
