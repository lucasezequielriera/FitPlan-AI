import type { GetServerSideProps } from "next";

/**
 * Punto de entrada /en → landing principal en inglés (YouTube / ads US).
 */
export default function EnIndex() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/en/transformacion-fitplan",
      permanent: false,
    },
  };
};
