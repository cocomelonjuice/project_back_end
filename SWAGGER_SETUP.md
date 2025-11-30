# 📚 Swagger/OpenAPI Documentation Setup

## ✅ Swagger Configuration Complete

All 82 APIs are now documented with Swagger/OpenAPI!

---

## 🚀 Access Swagger Documentation

Once your server is running, access Swagger UI at:

**URL:** `http://localhost:3000/api`

Or if you changed the port in `.env`:
**URL:** `http://localhost:<YOUR_PORT>/api`

---

## 📋 What's Documented

### ✅ All Controllers Have:
- `@ApiTags()` - Groups APIs by category
- `@ApiOperation()` - Description for each endpoint
- `@ApiResponse()` - Response status codes and descriptions
- `@ApiParam()` - Parameter descriptions
- `@ApiQuery()` - Query parameter descriptions (where applicable)
- `@ApiBearerAuth()` - JWT authentication indicator (for protected routes)

### ✅ Protected Endpoints:
All endpoints requiring JWT authentication are marked with:
- `@ApiBearerAuth('JWT-auth')`
- You can test them directly in Swagger UI by clicking "Authorize" and entering your JWT token

---

## 🎯 API Categories in Swagger

1. **Authentication** - User registration and login
2. **Users** - User management
3. **Projects** - Project CRUD operations
4. **Issue Types** - Issue type management
5. **Priorities** - Priority management
6. **Statuses** - Status management
7. **Issues** - Issue CRUD and operations
8. **Boards** - Board management
9. **Sprints** - Sprint management and lifecycle
10. **Comments** - Comment management on issues
11. **Attachments** - File attachment management
12. **Labels** - Label management and issue tagging
13. **Workflows** - Workflow and status transition management
14. **Roles** - Role and permission management
15. **Notifications** - User notification management
16. **Audit Logs** - Audit log viewing

---

## 🔐 Testing Protected Endpoints

### Step 1: Get JWT Token
1. Use `POST /auth/login` or `POST /auth/register` in Swagger
2. Copy the `accessToken` from the response

### Step 2: Authorize in Swagger
1. Click the **"Authorize"** button (lock icon) at the top of Swagger UI
2. Enter your JWT token (without "Bearer" prefix)
3. Click **"Authorize"**
4. Now all protected endpoints will include the token automatically

---

## 📝 Features

- ✅ **Interactive API Testing** - Test all endpoints directly from Swagger UI
- ✅ **Request/Response Examples** - See example payloads and responses
- ✅ **Authentication Support** - JWT token authorization built-in
- ✅ **Parameter Validation** - See required/optional fields
- ✅ **Error Responses** - Documented error codes and messages
- ✅ **File Upload Support** - Attachments endpoint supports file uploads

---

## 🎨 Swagger UI Features

- **Try it out** - Test any endpoint directly
- **Schema View** - See request/response models
- **Code Generation** - Generate client code in various languages
- **Export** - Download OpenAPI JSON specification

---

## 📊 Total APIs Documented

**82 APIs** across 16 categories, all fully documented with:
- Operation summaries
- Request/response schemas
- Parameter descriptions
- Error responses
- Authentication requirements

---

## 🔧 Configuration

Swagger is configured in `src/main.ts`:
- Title: "Jira-like API"
- Version: "1.0"
- Bearer Auth: JWT token support
- Tags: Organized by feature category
- Persist Authorization: Token persists after page refresh

---

**Status:** ✅ **All APIs Documented and Ready!**

Start your server and visit `http://localhost:3000/api` to see the documentation!


