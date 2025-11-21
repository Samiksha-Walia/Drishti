// Firebase configuration for Project Drishti
// This is a mock configuration file for demonstration purposes

// Mock Firebase SDK
const firebase = {
  initializeApp: (config) => {
    console.log('Firebase initialized with config:', config);
    return {
      firestore: () => mockFirestore,
      auth: () => mockAuth
    };
  },
  firestore: () => mockFirestore,
  auth: () => mockAuth
};

// Mock Firestore
const mockFirestore = {
  collection: (name) => {
    console.log(`Accessing collection: ${name}`);
    return {
      doc: (id) => {
        console.log(`Accessing document: ${id} in collection: ${name}`);
        return {
          get: () => Promise.resolve({
            exists: true,
            data: () => {
              return { id, name: `Mock ${name} ${id}`, createdAt: new Date() };
            }
          }),
          set: (data) => {
            console.log(`Setting data for document: ${id} in collection: ${name}`, data);
            return Promise.resolve();
          },
          update: (data) => {
            console.log(`Updating document: ${id} in collection: ${name}`, data);
            return Promise.resolve();
          },
          delete: () => {
            console.log(`Deleting document: ${id} in collection: ${name}`);
            return Promise.resolve();
          }
        };
      },
      add: (data) => {
        const id = `mock-id-${Date.now()}`;
        console.log(`Adding document to collection: ${name}`, data);
        return Promise.resolve({ id });
      },
      where: () => {
        return {
          get: () => Promise.resolve({
            docs: [
              {
                id: 'mock-doc-1',
                data: () => ({ name: 'Mock Document 1' })
              },
              {
                id: 'mock-doc-2',
                data: () => ({ name: 'Mock Document 2' })
              }
            ]
          })
        };
      },
      onSnapshot: (callback) => {
        // Simulate real-time updates
        callback({
          docs: [
            {
              id: 'mock-doc-1',
              data: () => ({ name: 'Mock Document 1' })
            },
            {
              id: 'mock-doc-2',
              data: () => ({ name: 'Mock Document 2' })
            }
          ]
        });
        
        // Return unsubscribe function
        return () => console.log('Unsubscribed from collection:', name);
      }
    };
  }
};

// Mock Auth
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (callback) => {
    // Simulate a signed-in user after a delay
    setTimeout(() => {
      mockAuth.currentUser = {
        uid: 'mock-user-123',
        email: 'demo@projectdrishti.com',
        displayName: 'Demo User',
        photoURL: 'https://via.placeholder.com/150'
      };
      callback(mockAuth.currentUser);
    }, 1000);
    
    // Return unsubscribe function
    return () => console.log('Unsubscribed from auth state changes');
  },
  signIn: () => {
    mockAuth.currentUser = {
      uid: 'mock-user-123',
      email: 'demo@projectdrishti.com',
      displayName: 'Demo User',
      photoURL: 'https://via.placeholder.com/150'
    };
    return Promise.resolve(mockAuth.currentUser);
  },
  signOut: () => {
    mockAuth.currentUser = null;
    return Promise.resolve();
  }
};

// Export the mock Firebase
window.firebase = firebase;