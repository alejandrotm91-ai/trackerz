const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');
content = content.replace(
  "import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, Copy, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';",
  "import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, Copy, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown, RotateCcw, CheckCircle2 } from 'lucide-react';"
);
fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
