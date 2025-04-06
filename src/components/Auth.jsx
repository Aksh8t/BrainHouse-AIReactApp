import { SignIn, SignUp } from '@clerk/clerk-react';

export default function Auth() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Welcome to My App</h1>
      <div className="flex gap-4">
        <div>
          <h2 className="text-xl mb-4">Sign In</h2>
          <SignIn routing="path" path="/sign-in" />
        </div>
        <div>
          <h2 className="text-xl mb-4">Sign Up</h2>
          <SignUp routing="path" path="/sign-up" />
        </div>
      </div>
    </div>
  );
}