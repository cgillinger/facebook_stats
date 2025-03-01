# Facebook Statistics Web Application

A web-based application for analyzing and visualizing Facebook post statistics. This tool allows users to upload CSV export files from Facebook Insights, process the data, and view comprehensive analytics in both account-level and post-level views.

<p align="center">
  <img src="public/Icon.png" alt="Facebook Statistics App Logo" width="120">
</p>

## 📊 Features

- **CSV Data Import**: Upload Facebook Insights CSV export files for analysis
- **Dual View Analytics**: 
  - Account-level statistics with aggregated metrics
  - Post-level statistics with detailed data for each post
- **Customizable Views**: Select which metrics to display in tables
- **Data Sorting & Filtering**: Sort by any column, filter by account
- **Export Capabilities**: Export analyzed data to CSV or Excel
- **Column Mapping Management**: Adapt to Facebook's changing column names without code modifications
- **Duplicate Detection**: Automatically identifies and filters out duplicate entries
- **Client-side Processing**: All data stays in your browser, enhancing privacy
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm (v8 or later)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/facebook-statistics-web.git
   cd facebook-statistics-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173` (or the port shown in your terminal)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready to be deployed to any static web hosting service.

## 🔍 How to Use

### Importing Data

1. Export your data from Facebook Insights as a CSV file
2. Click "Upload CSV" or drag and drop your file onto the upload area
3. The application will process the data and display it in the selected view

### Column Mappings

If Meta changes their CSV column names (which happens occasionally), you can update the mappings without changing code:

1. Click "Manage Column Mappings" 
2. Find the column with the old name
3. Update it to the new name that Meta is now using
4. Click "Save Changes"
5. Re-upload your CSV file to apply the new mappings

### Views and Filtering

- Switch between "Per Account" and "Per Post" views using the tabs
- Select metrics to display using the checkboxes
- In the Post view, filter by account using the dropdown
- Sort any column by clicking on the column header

### Data Export

- Use the CSV or Excel buttons to export the data shown in the current view
- Exported files include all selected metrics

## 📂 Project Structure

```
/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── AccountView/  # Account-level analytics view
│   │   ├── ColumnMappingEditor/ # Column mapping management
│   │   ├── FileUploader/ # CSV file upload handling
│   │   ├── MainView/     # Main application view
│   │   ├── PostView/     # Post-level analytics view
│   │   └── ui/           # UI components (buttons, cards, etc.)
│   ├── utils/           # Utility functions
│   │   ├── dataProcessing.js    # Data processing functions
│   │   ├── webDataProcessor.js  # Web-specific data processing
│   │   └── webStorageService.js # Browser storage management
│   ├── App.jsx          # Main application component
│   └── index.jsx        # Application entry point
├── package.json         # Project dependencies and scripts
├── tailwind.config.js   # Tailwind CSS configuration
├── vite.config.js       # Vite configuration
└── README.md            # Project documentation
```

## 🔧 Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application for production
- `npm run preview`: Preview the production build locally

## 🛠️ Technical Details

### Core Technologies

- **React**: UI library for building the user interface
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for styling
- **PapaParse**: CSV parsing library
- **SheetJS**: Excel file generation
- **Radix UI**: Accessible UI primitives
- **Lucide Icons**: SVG icon library

### Data Processing

The application processes CSV data in the following steps:

1. Parse the CSV file using PapaParse
2. Validate column names against configured mappings
3. Identify and filter duplicate entries
4. Map external column names to internal field names
5. Create data structures for account and post views
6. Calculate aggregate metrics for the account view
7. Store processed data in browser storage (localStorage/IndexedDB)

### Storage

The application uses browser storage mechanisms:

- **localStorage**: For configuration settings and small datasets
- **IndexedDB**: For larger datasets that exceed localStorage limits

No data is sent to any server - all processing happens in your browser.

## 🔒 Security and Privacy

- **Client-Side Only**: All data processing happens in your browser
- **No External Servers**: No data is sent to any external servers
- **No Authentication**: The app doesn't require any login or API keys
- **Data Isolation**: Each user's data is isolated to their browser

## 🔌 Electron Support

The application is designed to work both as a web application and as an Electron desktop application. The main differences are:

- In Electron, files are read/written to the filesystem
- In the web version, browser storage (localStorage/IndexedDB) is used
- The `electronApiEmulator.js` provides a compatibility layer for the web version

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 📚 Acknowledgements

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PapaParse](https://www.papaparse.com/)
- [SheetJS](https://sheetjs.com/)
- [Radix UI](https://radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)
