import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir:'e2e', testMatch:'*.spec.ts', timeout:90000, workers:1,
  use:{baseURL:'http://127.0.0.1:8081',trace:'retain-on-failure'},
  webServer:{command:'node scripts/serve.mjs preview-dist 8081',url:'http://127.0.0.1:8081',reuseExistingServer:true},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
    {name:'webkit-phone',use:{...devices['iPhone 13'],browserName:'webkit'}}
  ]
});
