# API Endpoints

Endpoints the frontend calls through the shared axios client (`src/api/client.ts`). The AI/scraping backend **does not exist yet** — these are the contracts the backend should implement. Requests carry `Authorization: Bearer <supabase-access-token>` (attached by the client interceptor). All request and response payloads are Zod-validated in feature services under `src/features/*/services/` + `types/schemas/`.

Conventions:

- Errors use HTTP status codes; the body is `{ message: string }` where possible.
- The axios client cancels requests made while unauthenticated, so all endpoints below require auth unless noted.

| Method | Path                   | Purpose | Feature |
| ------ | ---------------------- | ------- | ------- |
| POST   | `/ai/generate-recipe`  | Generate a recipe from requirements (ingredients on hand, cuisine, calories, time, dietary). Returns a recipe draft. | recipes |
| POST   | `/ai/edit-recipe`      | Apply a natural-language change description to a recipe. Returns the edited draft. | recipes |
| POST   | `/ai/analyze-nutrition`| Analyze a recipe's nutrition; returns macros + healthier-alternative suggestions. | recipes |
| POST   | `/ai/chat`             | Send a chat message (with model id + session context) to the cooking assistant; returns assistant reply. | ai-assistant |
| GET    | `/ai/models`           | List AI models available to the current subscription tier. | profile / ai-assistant |
| POST   | `/recipes/import`      | Scrape a recipe from an external URL. Returns a recipe draft for review. | recipes |
| POST   | `/orders`              | Order the ingredients of a shopping list from a grocery partner. | shopping |
| POST   | `/billing/subscribe`   | Request a plan change (placeholder payment flow; backend records intent). | payment |
| POST   | `/billing/tokens`      | Purchase an extra token top-up for the premium quota. | payment |

## Request/response sketches

### POST /ai/generate-recipe

```jsonc
// request
{ "ingredients": ["tomatoes", "rice", "chicken"], "cuisine": "Italian", "maxCalories": 600, "maxPrepMinutes": 45, "dietaryTags": ["gluten-free"], "modelId": "uuid" }
// response
{ "recipe": { "title": "...", "description": "...", "prepTimeMinutes": 30, "servings": 4, "cuisine": "...", "ingredients": [{ "name": "...", "amount": 200, "unit": "g" }], "steps": [{ "instruction": "..." }], "caloriesPerServing": 540, "dietaryTags": [] } }
```

### POST /ai/edit-recipe

```jsonc
// request
{ "recipe": { ...full recipe draft... }, "instruction": "make it vegetarian and double the sauce", "modelId": "uuid" }
// response
{ "recipe": { ...edited draft... }, "summary": "Replaced chicken with tofu; doubled sauce quantities." }
```

### POST /ai/analyze-nutrition

```jsonc
// request
{ "recipe": { ...full recipe draft... }, "modelId": "uuid" }
// response
{ "caloriesPerServing": 540, "proteinGrams": 32, "carbsGrams": 48, "fatGrams": 14, "suggestions": ["Use Greek yogurt instead of cream to cut 8g fat per serving."] }
```

### POST /ai/chat

```jsonc
// request
{ "sessionId": "local-uuid", "messages": [{ "role": "user", "content": "..." }], "modelId": "uuid" }
// response
{ "reply": "markdown string", "tokensUsed": 412 }
```

### POST /recipes/import

```jsonc
// request
{ "url": "https://example.blog/recipe" }
// response
{ "recipe": { ...same draft shape as generate-recipe... } }
```

### POST /orders

```jsonc
// request
{ "shoppingListId": "uuid", "items": [{ "name": "...", "quantity": 2, "unit": "kg" }] }
// response
{ "orderId": "ord_123", "status": "placed" }
```

### POST /billing/subscribe · POST /billing/tokens

```jsonc
// subscribe request
{ "planId": "uuid" }
// tokens request
{ "tokens": 10000 }
// both respond
{ "status": "pending", "message": "Request recorded; payment flow will complete here once integrated." }
```
