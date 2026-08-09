<template>
  <div class="mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-xl items-center px-5 py-12 text-center">
    <div>
      <div class="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-800">
        <UIcon
          name="i-lucide-user-round-x"
          class="size-8"
        />
      </div><h1 class="mt-6 font-display text-4xl font-extrabold tracking-tight">
        An invitation is required.
      </h1><p class="mt-4 text-slate-600">
        Mind Boggling is for invited friends and family. Ask the platform administrator to invite your email through Clerk, then return here to sign in.
      </p><UButton
        to="/sign-in"
        class="mt-7"
        trailing-icon="i-lucide-arrow-right"
      >
        Back to sign in
      </UButton>
    </div>
  </div>
</template>
