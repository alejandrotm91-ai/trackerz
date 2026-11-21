const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const importStatements = `
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { saveMasterPlanToDb, getMasterPlanFromDb } from './src/db/masterCdo.ts';
`;

const routes = `
  // Master CDO Sync API Routes
  app.post("/api/master-cdo/save", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { planId, planData, items } = req.body;
      if (!planId || !planData || !items) {
        return res.status(400).json({ error: 'Missing required data' });
      }
      
      // Update the updater info with the authenticated user's email
      planData.updatedBy = req.user?.email || planData.updatedBy || 'Unknown User';
      
      await saveMasterPlanToDb(planId, planData, items);
      res.json({ success: true, message: 'Plan saved successfully' });
    } catch (error: any) {
      console.error("Failed to save master plan:", error);
      res.status(500).json({ error: error.message || "Failed to save master plan" });
    }
  });

  app.get("/api/master-cdo/load/:planId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const planId = req.params.planId;
      const data = await getMasterPlanFromDb(planId);
      if (!data) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Failed to load master plan:", error);
      res.status(500).json({ error: error.message || "Failed to load master plan" });
    }
  });
`;

// Inject imports
content = content.replace('import dotenv from "dotenv";', 'import dotenv from "dotenv";' + importStatements);

// Inject routes before Vite middleware
content = content.replace('// Vite middleware for development', routes + '\n  // Vite middleware for development');

fs.writeFileSync('server.ts', content);
